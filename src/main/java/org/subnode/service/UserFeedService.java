package org.subnode.service;

import java.util.Arrays;
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
import org.subnode.config.NodeName;
import org.subnode.config.SessionContext;
import org.subnode.model.NodeInfo;
import org.subnode.model.client.NodeProp;
import org.subnode.model.client.NodeType;
import org.subnode.model.client.PrincipalName;
import org.subnode.model.client.PrivilegeType;
import org.subnode.mongo.AdminRun;
import org.subnode.mongo.MongoAuth;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.MongoUpdate;
import org.subnode.mongo.MongoUtil;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.CheckMessagesRequest;
import org.subnode.request.NodeFeedRequest;
import org.subnode.response.CheckMessagesResponse;
import org.subnode.response.NodeFeedResponse;
import org.subnode.util.AsyncExec;
import org.subnode.util.Convert;
import org.subnode.util.ThreadLocals;

@Component
public class UserFeedService {
	private static final Logger log = LoggerFactory.getLogger(UserFeedService.class);

	static final int MAX_FEED_ITEMS = 25;

	@Autowired
	private MongoRead read;

	@Autowired
	private MongoUpdate update;

	@Autowired
	private Convert convert;

	@Autowired
	private MongoAuth auth;

	@Autowired
	private MongoUtil util;

	@Autowired
	private UserManagerService userManagerService;

	@Autowired
	private MongoTemplate ops;

	@Autowired
	private AdminRun arun;

	@Autowired
	private AsyncExec asyncExec;

	@Autowired
	@Qualifier("threadPoolTaskExecutor")
	private Executor executor;

	private static List<String> excludeTypes = Arrays.asList( //
			NodeType.FRIEND.s(), //
			NodeType.POSTS.s(), //
			NodeType.ACT_PUB_POSTS.s());

	public CheckMessagesResponse checkMessages(MongoSession session, CheckMessagesRequest req) {
		SessionContext sc = ThreadLocals.getSC();
		CheckMessagesResponse res = new CheckMessagesResponse();

		if (sc.isAnonUser())
			return res;

		session = ThreadLocals.ensure(session);
		String pathToSearch = NodeName.ROOT_OF_ALL_USERS;

		Query query = new Query();
		Criteria criteria = Criteria.where(SubNode.FIELD_PATH).regex(util.regexRecursiveChildrenOfPath(pathToSearch)) //

				// This pattern is what is required when you have multiple conditions added to a single field.
				.andOperator(Criteria.where(SubNode.FIELD_TYPE).ne(NodeType.FRIEND.s()), //
						Criteria.where(SubNode.FIELD_TYPE).ne(NodeType.POSTS.s()), //
						Criteria.where(SubNode.FIELD_TYPE).ne(NodeType.ACT_PUB_POSTS.s()));

		SubNode searchRoot = read.getNode(session, sc.getRootId());

		Long lastActiveLong = searchRoot.getIntProp(NodeProp.LAST_ACTIVE_TIME.s());
		if (lastActiveLong == 0) {
			return res;
		}

		/* new nodes since last active time */
		criteria = criteria.and(SubNode.FIELD_MODIFY_TIME).gt(new Date(lastActiveLong));
		String myId = searchRoot.getOwner().toHexString();
		criteria = criteria.and(SubNode.FIELD_AC + "." + myId).ne(null);

		query.addCriteria(criteria);

		long count = ops.count(query, SubNode.class);
		res.setNumNew((int) count);
		return res;
	}

	/*
	 * Generated content of the "Feed" for a user.
	 * 
	 */
	public NodeFeedResponse generateFeed(MongoSession session, NodeFeedRequest req) {
		SessionContext sc = ThreadLocals.getSC();
		NodeFeedResponse res = new NodeFeedResponse();
		session = ThreadLocals.ensure(session);

		String pathToSearch = NodeName.ROOT_OF_ALL_USERS;
		boolean doAuth = true;

		/*
		 * if we're doing a 'feed' under a specific root node this is like the 'chat feature' and is
		 * normally only called for a chat-room type node.
		 */
		if (req.getNodeId() != null) {
			// Get the chat room node (root of the chat room query)
			SubNode rootNode = read.getNode(session, req.getNodeId());
			if (rootNode == null) {
				throw new RuntimeException("Node not found: " + req.getNodeId());
			}
			pathToSearch = rootNode.getPath();

			/* if the chat root is public disable all auth logic in this method */
			if (AclService.isPublic(session, rootNode)) {
				// do nothing, for now.
			}
			/*
			 * If chat node is NOT public we try to check out read auth on it and if not this will throw an
			 * exception which is the correct flow here
			 */
			else {
				try {
					auth.auth(session, rootNode, PrivilegeType.READ, PrivilegeType.WRITE);
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

		// todo-1: should the 'friends' and 'public' options be mutually exclusive?? If someone's looking for
		// all public nodes why "OR" into that any friends?
		if (doAuth && req.getToPublic()) {
			orCriteria.add(Criteria.where(SubNode.FIELD_AC + "." + PrincipalName.PUBLIC.s()).ne(null));
		}

		SubNode myAcntNode = null;

		// includes shares TO me.
		if (doAuth && req.getToMe()) {
			myAcntNode = read.getNode(session, sc.getRootId());

			if (myAcntNode != null) {
				orCriteria.add(Criteria.where(SubNode.FIELD_AC + "." + myAcntNode.getOwner().toHexString()).ne(null));

				final SubNode _myAcntNode = myAcntNode;
				final MongoSession _s = session;
				long lastActiveTime = sc.getLastActiveTime();
				// do this work in async thread to make this query more performant
				asyncExec.run(ThreadLocals.getContext(), () -> {
					/*
					 * setting last active time to this current time, will stop the GUI from showing the user an
					 * indication that they have new messages, because we know they're querying messages NOW, so this is
					 * a way to reset
					 */
					_myAcntNode.setProp(NodeProp.LAST_ACTIVE_TIME.s(), lastActiveTime);
					update.save(_s, _myAcntNode);
				});
			}
		}
		List<NodeInfo> searchResults = new LinkedList<>();
		res.setSearchResults(searchResults);

		Query query = new Query();

		/*
		 * construct the list of ANDed conditions for the whole query, we can only have one list if ANDs due
		 * to MongoDB restriction.
		 * 
		 * todo-0: check if these (the 'ands' list) could've all been accomplished as criteria =
		 * criteria.and, because I'm unsure as of right now. I'm pretty sure becasue if you look at how
		 * blocked users are done below it's just 'criteria.and' which is the same thing this 'ands' does.
		 */
		// DO NOT DELETE
		// (Keep 'ands' for future reference in case we need that code pattern ever)
		// List<Criteria> ands = new LinkedList<>();

		// initialize criteria using the Path to select the correct sub-graph of the tree
		Criteria criteria = Criteria.where(SubNode.FIELD_PATH).regex(util.regexRecursiveChildrenOfPath(pathToSearch)); //

		if (req.getNodeId() == null) {
			// ands.add(Criteria.where(SubNode.FIELD_TYPE).nin(excludeTypes));//
			criteria = criteria.and(SubNode.FIELD_TYPE).nin(excludeTypes);
		}

		// add the criteria for sensitive flag
		if (!req.getNsfw()) {
			criteria = criteria.and(SubNode.FIELD_PROPERTIES + "." + NodeProp.ACT_PUB_SENSITIVE + ".value").is(null);
		}

		HashSet<ObjectId> blockedUserIds = new HashSet<>();

		/*
		 * Users can manually add a property named "unpublish" to have a "public" node that nonetheles
		 * doesn't show up in any feeds, but in the future maybe we will make this a checkbox on the editor.
		 */
		// disabling. I don't want to sacrifice any performance for this (yet)
		// criteria = criteria.and(SubNode.FIELD_PROPERTIES + "." + NodeProp.UNPUBLISHED +
		// ".value").is(null);

		// Add criteria for blocking users using the 'not in' list (nin)
		getBlockedUserIds(blockedUserIds);
		if (blockedUserIds.size() > 0) {
			criteria = criteria.and(SubNode.FIELD_OWNER).nin(blockedUserIds);
		}

		/*
		 * Save the 'string' representations for blocked user ids for use below, to mask out places where
		 * users may be following a user that will effectively be blocked
		 */
		HashSet<String> blockedIdStrings = new HashSet<>();
		for (ObjectId blockedId : blockedUserIds) {
			blockedIdStrings.add(blockedId.toHexString());
		}

		// reset feedMaxTime if we're getting first page of results
		if (req.getPage() == 0) {
			sc.setFeedMaxTime(null);
		}
		// if not getting first page of results use the modifyTime < feedMaxTime to ensure good paging.
		else if (sc.getFeedMaxTime() != null) {
			criteria = criteria.and(SubNode.FIELD_MODIFY_TIME).lt(sc.getFeedMaxTime());
		}

		if (doAuth && req.getFromMe()) {
			if (myAcntNode == null) {
				myAcntNode = read.getNode(session, sc.getRootId());
			}

			if (myAcntNode != null) {
				orCriteria.add(
						// where node is owned by us.
						Criteria.where(SubNode.FIELD_OWNER).is(myAcntNode.getOwner()) //
								// and the node has any sharing on it.
								.and(SubNode.FIELD_AC).ne(null));
			}
		}

		if (doAuth && req.getFromFriends()) {
			List<SubNode> friendNodes = userManagerService.getSpecialNodesList(session, NodeType.FRIEND_LIST.s(), null, true);
			if (friendNodes != null) {
				List<ObjectId> friendIds = new LinkedList<>();

				for (SubNode friendNode : friendNodes) {
					// the USER_NODE_ID property on friends nodes contains the actual account ID of this friend.
					String userNodeId = friendNode.getStrProp(NodeProp.USER_NODE_ID);

					// if we have a userNodeId and they aren't in the blocked list.
					if (userNodeId != null && !blockedIdStrings.contains(userNodeId)) {
						friendIds.add(new ObjectId(userNodeId));
						// orCriteria.add(Criteria.where(SubNode.FIELD_OWNER).is(new ObjectId(userNodeId)));
					}
				}

				if (friendIds.size() > 0) {
					orCriteria.add(Criteria.where(SubNode.FIELD_OWNER).in(friendIds));
				}
			}
		}

		if (orCriteria.size() > 0) {
			// ands.add(new Criteria().orOperator((Criteria[]) orCriteria.toArray(new Criteria[orCriteria.size()])));
			criteria = criteria.orOperator((Criteria[]) orCriteria.toArray(new Criteria[orCriteria.size()]));
		}

		// Only one andOperator call is allowed so we accumulate 'ands' in the list before using.
		// if (ands.size() > 0) {
		// 	criteria.andOperator(ands);
		// }

		// use attributedTo proptery to determine whether a node is 'local' (posted by this server) or not.
		if (req.getLocalOnly()) {
			// todo-1: should be checking apid property instead? 
			criteria = criteria.and(SubNode.FIELD_PROPERTIES + "." + NodeProp.ACT_PUB_OBJ_ATTRIBUTED_TO.s() + ".value").is(null);
		}

		if (!StringUtils.isEmpty(req.getSearchText())) {
			TextCriteria textCriteria = TextCriteria.forDefaultLanguage();
			textCriteria.matching(req.getSearchText());
			textCriteria.caseSensitive(false);
			query.addCriteria(textCriteria);
		}

		query.addCriteria(criteria);

		// if we have a node id this is like a chat room type, and so we sort by create time.
		if (req.getNodeId() != null) {
			query.with(Sort.by(Sort.Direction.DESC, SubNode.FIELD_CREATE_TIME));
		} else {
			query.with(Sort.by(Sort.Direction.DESC, SubNode.FIELD_MODIFY_TIME));
		}
		query.limit(MAX_FEED_ITEMS);

		if (req.getPage() > 0) {
			query.skip(MAX_FEED_ITEMS * req.getPage());
		}

		sc.stopwatch("NodeFeedQuery--Start");
		Iterable<SubNode> iter = util.find(query);
		sc.stopwatch("NodeFeedQuery--Complete");
		SubNode lastNode = null;

		for (SubNode node : iter) {
			try {
				NodeInfo info =
						convert.convertToNodeInfo(sc, session, node, true, false, counter + 1, false, false, false, false);
				searchResults.add(info);
				lastNode = node;
			} catch (Exception e) {
			}
		}

		sc.stopwatch("NodeFeedQuery--Iterated");

		/*
		 * This is the correct logic since we only have a 'more' button and no 'back' button so that as the
		 * user clicks more button we go further back in time and always update feedMaxTime here to ensure
		 * we don't encounter records we've already seen
		 */
		if (lastNode != null) {
			sc.setFeedMaxTime(lastNode.getModifyTime());
		}

		if (searchResults.size() < MAX_FEED_ITEMS) {
			res.setEndReached(true);
		}

		res.setSuccess(true);
		// log.debug("search results count: " + counter);
		return res;
	}

	public void getBlockedUserIds(HashSet<ObjectId> set) {
		arun.run(ms -> {
			List<SubNode> nodeList = userManagerService.getSpecialNodesList(ms, NodeType.BLOCKED_USERS.s(), null, false);
			if (nodeList == null)
				return null;

			for (SubNode node : nodeList) {
				String userNodeId = node.getStrProp(NodeProp.USER_NODE_ID.s());
				ObjectId oid = new ObjectId(userNodeId);
				set.add(oid);
			}
			return null;
		});
	}
}
