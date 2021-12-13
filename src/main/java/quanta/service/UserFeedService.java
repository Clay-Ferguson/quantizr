package quanta.service;

import java.util.Date;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.concurrent.Executor;
import org.apache.commons.lang3.StringUtils;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.TextCriteria;
import org.springframework.stereotype.Component;
import quanta.config.NodeName;
import quanta.config.SessionContext;
import quanta.model.NodeInfo;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.model.client.PrincipalName;
import quanta.model.client.PrivilegeType;
import quanta.mongo.AdminRun;
import quanta.mongo.MongoAuth;
import quanta.mongo.MongoRead;
import quanta.mongo.MongoSession;
import quanta.mongo.MongoUpdate;
import quanta.mongo.MongoUtil;
import quanta.mongo.model.SubNode;
import quanta.request.CheckMessagesRequest;
import quanta.request.NodeFeedRequest;
import quanta.response.CheckMessagesResponse;
import quanta.response.NodeFeedResponse;
import quanta.util.AsyncExec;
import quanta.util.Convert;
import quanta.util.ThreadLocals;
import static quanta.util.Util.*;

@Component
public class UserFeedService  {
	private static final Logger log = LoggerFactory.getLogger(UserFeedService.class);

	@Autowired
	protected Convert convert;

	@Autowired
	protected MongoTemplate ops;

	@Autowired
	protected AsyncExec asyncExec;

	@Autowired
	protected AdminRun arun;

	@Autowired
	protected UserManagerService user;

	@Autowired
	protected MongoUtil mongoUtil;

	@Autowired
	protected MongoAuth auth;

	@Autowired
	protected MongoUpdate update;

	@Autowired
	protected MongoRead read;

	static final int MAX_FEED_ITEMS = 25;

	@Autowired
	@Qualifier("threadPoolTaskExecutor")
	private Executor executor;

	// DO NOT DELETE (part of example to keep below)
	// private static List<String> excludeTypes = Arrays.asList( //
	// NodeType.FRIEND.s(), //
	// NodeType.POSTS.s(), //
	// NodeType.ACT_PUB_POSTS.s());

	public CheckMessagesResponse checkMessages(MongoSession ms, CheckMessagesRequest req) {
		SessionContext sc = ThreadLocals.getSC();
		CheckMessagesResponse res = new CheckMessagesResponse();

		if (sc.isAnonUser())
			return res;

		ms = ThreadLocals.ensure(ms);
		String pathToSearch = NodeName.ROOT_OF_ALL_USERS;

		Query query = new Query();
		Criteria criteria = Criteria.where(SubNode.PATH).regex(mongoUtil.regexRecursiveChildrenOfPath(pathToSearch)); //

		// limit to just markdown types (no type)
		criteria = criteria.and(SubNode.TYPE).is(NodeType.NONE.s());

		// DO NOT DELETE (keep as example)
		// This pattern is what is required when you have multiple conditions added to a single field.
		// .andOperator(Criteria.where(SubNode.FIELD_TYPE).ne(NodeType.FRIEND.s()), //
		// Criteria.where(SubNode.FIELD_TYPE).ne(NodeType.POSTS.s()), //
		// Criteria.where(SubNode.FIELD_TYPE).ne(NodeType.ACT_PUB_POSTS.s()));

		SubNode searchRoot = read.getNode(ms, sc.getRootId());

		Long lastActiveLong = searchRoot.getInt(NodeProp.LAST_ACTIVE_TIME);
		if (lastActiveLong == 0) {
			return res;
		}

		/* new nodes since last active time */
		criteria = criteria.and(SubNode.MODIFY_TIME).gt(new Date(lastActiveLong));
		String myId = searchRoot.getOwner().toHexString();
		criteria = criteria.and(SubNode.AC + "." + myId).ne(null);

		query.addCriteria(criteria);

		long count = ops.count(query, SubNode.class);
		res.setNumNew((int) count);
		return res;
	}

	/*
	 * Generated content of the "Feed" for a user.
	 * 
	 */
	public NodeFeedResponse generateFeed(MongoSession ms, NodeFeedRequest req) {
		/*
		 * Set this flag to generate large resultset of all nodes in root, just for exercising this method
		 * without 'real' data.
		 */
		boolean testQuery = false;

		SessionContext sc = ThreadLocals.getSC();
		NodeFeedResponse res = new NodeFeedResponse();
		ms = ThreadLocals.ensure(ms);

		String pathToSearch = testQuery ? "/r" : NodeName.ROOT_OF_ALL_USERS;
		boolean doAuth = true;

		/*
		 * if we're doing a 'feed' under a specific root node this is like the 'chat feature' and is
		 * normally only called for a chat-room type node.
		 */
		if (ok(req.getNodeId())) {
			// Get the chat room node (root of the chat room query)
			SubNode rootNode = read.getNode(ms, req.getNodeId());
			if (no(rootNode)) {
				throw new RuntimeException("Node not found: " + req.getNodeId());
			}
			pathToSearch = rootNode.getPath();

			/* if the chat root is public disable all auth logic in this method */
			if (AclService.isPublic(ms, rootNode)) {
				// do nothing, for now.
			}
			/*
			 * If chat node is NOT public we try to check out read auth on it and if not this will throw an
			 * exception which is the correct flow here
			 */
			else {
				try {
					auth.auth(ms, rootNode, PrivilegeType.READ, PrivilegeType.WRITE);
				} catch (Exception e) {
					sc.setWatchingPath(null);
					throw e;
				}
			}
			/*
			 * Then we set the public chat to indicate to the rest of the code below not to do any further
			 * authorization, becasue the way ACL works on chart rooms is if a person is authorized to READ
			 * (what about WRITE? todo-1: probably should make the above read and write) the actual CHAT NODE
			 * itself (the root of the chat nodes) then they are known to be granted access to all children
			 */
			doAuth = false;
			sc.setWatchingPath(pathToSearch);
		} else {
			sc.setWatchingPath(null);
		}

		int counter = 0;
		List<Criteria> orCriteria = new LinkedList<>();

		/*
		 * todo-1: should the 'friends' and 'public' options be mutually exclusive?? If someone's looking
		 * for all public nodes why "OR" into that any friends?
		 */
		if (!testQuery && doAuth && req.getToPublic()) {
			orCriteria.add(Criteria.where(SubNode.AC + "." + PrincipalName.PUBLIC.s()).ne(null));
		}

		SubNode myAcntNode = null;

		// includes shares TO me.
		if (!testQuery && doAuth && req.getToMe()) {
			myAcntNode = read.getNode(ms, sc.getRootId());

			if (ok(myAcntNode)) {
				orCriteria.add(Criteria.where(SubNode.AC + "." + myAcntNode.getOwner().toHexString()).ne(null));

				SubNode _myAcntNode = myAcntNode;
				MongoSession _s = ms;
				long lastActiveTime = sc.getLastActiveTime();
				// do this work in async thread to make this query more performant
				asyncExec.run(ThreadLocals.getContext(), () -> {
					/*
					 * setting last active time to this current time, will stop the GUI from showing the user an
					 * indication that they have new messages, because we know they're querying messages NOW, so this is
					 * a way to reset
					 */
					_myAcntNode.set(NodeProp.LAST_ACTIVE_TIME.s(), lastActiveTime);
					update.save(_s, _myAcntNode);
				});
			}
		}
		List<NodeInfo> searchResults = new LinkedList<>();
		res.setSearchResults(searchResults);

		Query query = new Query();

		// initialize criteria using the Path to select the correct sub-graph of the tree
		Criteria criteria = Criteria.where(SubNode.PATH).regex(mongoUtil.regexRecursiveChildrenOfPath(pathToSearch)); //

		// DO NOT DELETE (keep as an example of how to do this)
		// if (no(req.getNodeId() )) {
		// criteria = criteria.and(SubNode.FIELD_TYPE).nin(excludeTypes);
		// }

		// limit to just markdown types (no type)
		criteria = criteria.and(SubNode.TYPE).is(NodeType.NONE.s());

		// add the criteria for sensitive flag
		if (!req.getNsfw()) {
			criteria = criteria.and(SubNode.PROPERTIES + "." + NodeProp.ACT_PUB_SENSITIVE + ".value").is(null);
		}

		HashSet<ObjectId> blockedUserIds = new HashSet<>();

		// Add criteria for blocking users using the 'not in' list (nin)
		getBlockedUserIds(blockedUserIds);
		if (blockedUserIds.size() > 0) {
			criteria = criteria.and(SubNode.OWNER).nin(blockedUserIds);
		}

		/*
		 * Save the 'string' representations for blocked user ids for use below, to mask out places where
		 * users may be following a user that will effectively be blocked
		 */
		HashSet<String> blockedIdStrings = new HashSet<>();
		for (ObjectId blockedId : blockedUserIds) {
			blockedIdStrings.add(blockedId.toHexString());
		}

		if (!testQuery && doAuth && req.getFromMe()) {
			if (no(myAcntNode)) {
				myAcntNode = read.getNode(ms, sc.getRootId());
			}

			if (ok(myAcntNode)) {
				orCriteria.add(
						// where node is owned by us.
						Criteria.where(SubNode.OWNER).is(myAcntNode.getOwner()) //
								// and the node has any sharing on it.
								.and(SubNode.AC).ne(null));
			}
		}

		if (!testQuery && doAuth && req.getFromFriends()) {
			List<SubNode> friendNodes = user.getSpecialNodesList(ms, NodeType.FRIEND_LIST.s(), null, true);
			if (ok(friendNodes)) {
				List<ObjectId> friendIds = new LinkedList<>();

				for (SubNode friendNode : friendNodes) {
					// the USER_NODE_ID property on friends nodes contains the actual account ID of this friend.
					String userNodeId = friendNode.getStr(NodeProp.USER_NODE_ID);

					// if we have a userNodeId and they aren't in the blocked list.
					if (ok(userNodeId) && !blockedIdStrings.contains(userNodeId)) {
						friendIds.add(new ObjectId(userNodeId));
					}
				}

				if (friendIds.size() > 0) {
					orCriteria.add(Criteria.where(SubNode.OWNER).in(friendIds));
				}
			}
		}

		if (orCriteria.size() > 0) {
			criteria = criteria.orOperator((Criteria[]) orCriteria.toArray(new Criteria[orCriteria.size()]));
		}

		// use attributedTo proptery to determine whether a node is 'local' (posted by this server) or not.
		if (req.getLocalOnly()) {
			// todo-1: should be checking apid property instead?
			criteria = criteria.and(SubNode.PROPERTIES + "." + NodeProp.ACT_PUB_OBJ_ATTRIBUTED_TO.s() + ".value").is(null);
		}

		if (!StringUtils.isEmpty(req.getSearchText())) {
			TextCriteria textCriteria = TextCriteria.forDefaultLanguage();
			textCriteria.matching(req.getSearchText());
			textCriteria.caseSensitive(false);
			query.addCriteria(textCriteria);
		}

		query.addCriteria(criteria);

		// if we have a node id this is like a chat room type, and so we sort by create time.
		if (ok(req.getNodeId())) {
			query.with(Sort.by(Sort.Direction.DESC, SubNode.CREATE_TIME));
		} else {
			query.with(Sort.by(Sort.Direction.DESC, SubNode.MODIFY_TIME));
		}
		query.limit(MAX_FEED_ITEMS);

		if (req.getPage() > 0) {
			query.skip(MAX_FEED_ITEMS * req.getPage());
		}

		sc.stopwatch("NodeFeedQuery--Start");
		Iterable<SubNode> iter = mongoUtil.find(query);
		sc.stopwatch("NodeFeedQuery--Complete");

		for (SubNode node : iter) {
			try {
				NodeInfo info = convert.convertToNodeInfo(sc, ms, node, true, false, counter + 1, false, false, false, false);
				searchResults.add(info);
			} catch (Exception e) {
			}
		}

		sc.stopwatch("NodeFeedQuery--Iterated");

		if (searchResults.size() < MAX_FEED_ITEMS) {
			res.setEndReached(true);
		}

		res.setSuccess(true);
		// log.debug("search results count: " + counter);
		return res;
	}

	public void getBlockedUserIds(HashSet<ObjectId> set) {
		arun.run(ms -> {
			List<SubNode> nodeList = user.getSpecialNodesList(ms, NodeType.BLOCKED_USERS.s(), null, false);
			if (no(nodeList))
				return null;

			for (SubNode node : nodeList) {
				String userNodeId = node.getStr(NodeProp.USER_NODE_ID.s());
				ObjectId oid = new ObjectId(userNodeId);
				set.add(oid);
			}
			return null;
		});
	}
}
