package org.subnode.service;

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
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter.SseEventBuilder;
import org.subnode.config.NodeName;
import org.subnode.config.SessionContext;
import org.subnode.model.NodeInfo;
import org.subnode.model.client.NodeProp;
import org.subnode.model.client.NodeType;
import org.subnode.model.client.PrincipalName;
import org.subnode.mongo.MongoAuth;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.MongoUpdate;
import org.subnode.mongo.MongoUtil;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.CheckMessagesRequest;
import org.subnode.request.NodeFeedRequest;
import org.subnode.response.CheckMessagesResponse;
import org.subnode.response.FeedPushInfo;
import org.subnode.response.NodeEditedPushInfo;
import org.subnode.response.NodeFeedResponse;
import org.subnode.response.ServerPushInfo;
import org.subnode.util.Convert;
import org.subnode.util.ThreadLocals;

@Component
public class UserFeedService {
	private static final Logger log = LoggerFactory.getLogger(UserFeedService.class);

	static final int MAX_FEED_ITEMS = 50;

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
	@Qualifier("threadPoolTaskExecutor")
	private Executor executor;

	/* Notify all users being shared to on this node */
	public void pushNodeUpdateToBrowsers(MongoSession session, SubNode node) {
		// log.debug("Pushing update to all friends: id=" + node.getId().toHexString());

		/* get list of userNames this node is shared to (one of them may be 'public') */
		List<String> usersSharedTo = auth.getUsersSharedTo(session, node);

		// if node has no sharing we're done here
		if (usersSharedTo == null) {
			return;
		}

		// put user names in a hash set for faster performance
		HashSet<String> usersSharedToSet = new HashSet<>();
		usersSharedToSet.addAll(usersSharedTo);

		/*
		 * Get a local list of 'allSessions' so we can release the lock on the SessionContent varible
		 * immediately
		 */
		List<SessionContext> allSessions = new LinkedList<>();
		synchronized (SessionContext.allSessions) {
			allSessions.addAll(SessionContext.allSessions);
		}

		/* Scan all sessions and push message to the ones that need to see it */
		for (SessionContext sc : allSessions) {
			/* Anonymous sessions won't have userName and can be ignored */
			if (sc.getUserName() == null)
				continue;

			/* build our push message payload */
			NodeInfo nodeInfo = convert.convertToNodeInfo(sc, session, node, true, false, 1, false, false);
			FeedPushInfo pushInfo = new FeedPushInfo(nodeInfo);

			/*
			 * push if the sc user is in the shared set or this session is OURs,
			 */
			if (usersSharedToSet.contains(sc.getUserName())) {
				// push notification message to browser
				sendServerPushInfo(sc, pushInfo);
			}
		}
	}

	/* Notify all browser timelines if they have new info */
	public void pushTimelineUpdateToBrowsers(MongoSession session, NodeInfo nodeInfo) {

		/*
		 * Get a local list of 'allSessions' so we can release the lock on the SessionContent varible
		 * immediately
		 */
		List<SessionContext> allSessions = new LinkedList<>();
		synchronized (SessionContext.allSessions) {
			allSessions.addAll(SessionContext.allSessions);
		}

		/* Scan all sessions and push message to the ones that need to see it */
		for (SessionContext sc : allSessions) {
			/* Anonymous sessions can be ignored */
			if (sc.getUserName() == null)
				continue;

			/*
			 * Nodes whose path starts with "timeline path", are subnodes of (or descendants of) the timeline
			 * node and therefore will be sent to their respecitve browsers
			 */
			if (sc.getTimelinePath() == null || !nodeInfo.getPath().startsWith(sc.getTimelinePath())) {
				continue;
			}

			NodeEditedPushInfo pushInfo = new NodeEditedPushInfo(nodeInfo);
			sendServerPushInfo(sc, pushInfo);
		}
	}

	public void sendServerPushInfo(SessionContext userSession, ServerPushInfo info) {
		// If user is currently logged in we have a session here.
		if (userSession == null)
			return;

		executor.execute(() -> {
			SseEmitter pushEmitter = userSession.getPushEmitter();
			if (pushEmitter == null)
				return;

			try {
				SseEventBuilder event = SseEmitter.event() //
						.data(info) //
						.id(String.valueOf(info.hashCode()))//
						.name(info.getType());

				pushEmitter.send(event);

				/*
				 * DO NOT DELETE. This way of sending also works, and I was originally doing it this way and picking
				 * up in eventSource.onmessage = e => {} on the browser, but I decided to use the builder instead
				 * and let the 'name' in the builder route different objects to different event listeners on the
				 * client. Not really sure if either approach has major advantages over the other.
				 * 
				 * pushEmitter.send(info, MediaType.APPLICATION_JSON);
				 */
			} catch (Exception ex) {
				pushEmitter.completeWithError(ex);
			}
		});
	}

	public CheckMessagesResponse checkMessages(MongoSession session, CheckMessagesRequest req) {

		SessionContext sc = ThreadLocals.getSessionContext();
		CheckMessagesResponse res = new CheckMessagesResponse();

		if (sc.isAnonUser())
			return res;

		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}

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
	 */
	public NodeFeedResponse generateFeed(MongoSession session, NodeFeedRequest req) {

		SessionContext sc = ThreadLocals.getSessionContext();
		NodeFeedResponse res = new NodeFeedResponse();
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}

		int counter = 0;

		/* Finds nodes that have shares to any of the people listed in sharedToAny */
		List<String> sharedToAny = new LinkedList<>();

		if (req.getToPublic()) {
			sharedToAny.add(PrincipalName.PUBLIC.s());
		}

		SubNode userAccountNode = null;

		// includes shares TO me.
		if (req.getToMe()) {
			if (userAccountNode == null) {
				userAccountNode = read.getNode(session, sc.getRootId());
			}

			if (userAccountNode != null) {
				sharedToAny.add(userAccountNode.getOwner().toHexString());

				/*
				 * setting last active time to this current time, will stop the GUI from showing the user an
				 * indication that they have new messages, because we know they're querying messages NOW, so this is
				 * a way to reset
				 */
				userAccountNode.setProp(NodeProp.LAST_ACTIVE_TIME.s(), sc.getLastActiveTime());
				update.save(session, userAccountNode);
			}
		}
		List<NodeInfo> searchResults = new LinkedList<>();
		res.setSearchResults(searchResults);
		String pathToSearch = NodeName.ROOT_OF_ALL_USERS;

		Query query = new Query();
		Criteria criteria = Criteria.where(SubNode.FIELD_PATH).regex(util.regexRecursiveChildrenOfPath(pathToSearch)) //

				// This pattern is what is required when you have multiple conditions added to a single field.
				.andOperator(Criteria.where(SubNode.FIELD_TYPE).ne(NodeType.FRIEND.s()), //
						Criteria.where(SubNode.FIELD_TYPE).ne(NodeType.POSTS.s()), //
						Criteria.where(SubNode.FIELD_TYPE).ne(NodeType.ACT_PUB_POSTS.s()));

		if (!req.getNsfw()) {
			criteria = criteria.and(SubNode.FIELD_PROPERTIES + "." + NodeProp.ACT_PUB_SENSITIVE + ".value").is(null);
		}

		/*
		 * Users can manually add a property named "unpublish" to have a "public" node that nonetheles
		 * doesn't show up in any feeds, but in the future maybe we will make this a checkbox on the editor.
		 */
		criteria = criteria.and(SubNode.FIELD_PROPERTIES + "." + NodeProp.UNPUBLISHED + ".value").is(null);

		List<ObjectId> blockedUserIds = getBlockedUserIds();
		if (blockedUserIds != null && blockedUserIds.size() > 0) {
			criteria = criteria.and(SubNode.FIELD_OWNER).nin(blockedUserIds);
		}

		// reset feedMaxTime if we're getting first page of results
		if (req.getPage() == 0) {
			sc.setFeedMaxTime(null);
		}
		// if not getting first page of results use the modifyTime < feedMaxTime to ensure good paging.
		else if (sc.getFeedMaxTime() != null) {
			criteria = criteria.and(SubNode.FIELD_MODIFY_TIME).lt(sc.getFeedMaxTime());
		}

		List<Criteria> orCriteria = new LinkedList<>();

		if (req.getFromMe()) {
			if (userAccountNode == null) {
				userAccountNode = read.getNode(session, sc.getRootId());
			}

			if (userAccountNode != null) {
				orCriteria.add(
						// where node is owned by us.
						Criteria.where(SubNode.FIELD_OWNER).is(userAccountNode.getOwner()) //
								// and the node has any sharing on it.
								.and(SubNode.FIELD_AC).ne(null));
			}
		}

		if (req.getFromFriends()) {
			List<SubNode> friendNodes = userManagerService.getSpecialNodesList(session, NodeType.FRIEND_LIST.s());
			if (friendNodes != null) {
				for (SubNode friendNode : friendNodes) {

					// the USER_NODE_ID property on friends nodes contains the actual account ID of this friend.
					String userNodeId = friendNode.getStrProp(NodeProp.USER_NODE_ID);
					if (userNodeId != null) {
						orCriteria.add(Criteria.where(SubNode.FIELD_OWNER).is(new ObjectId(userNodeId)));
					}
				}
			}
		}

		// or a node that is shared to any of the sharedToAny users
		for (String share : sharedToAny) {
			orCriteria.add(Criteria.where(SubNode.FIELD_AC + "." + share).ne(null));
		}

		if (orCriteria.size() == 0) {
			res.setSuccess(true);
			return res;
		}

		criteria.orOperator((Criteria[]) orCriteria.toArray(new Criteria[orCriteria.size()]));

		// use attributedTo proptery to determine whether a node is 'local' (posted by this server) or not.
		if (req.getLocalOnly()) {
			criteria = criteria.and(SubNode.FIELD_PROPERTIES + "." + NodeProp.ACT_PUB_OBJ_ATTRIBUTED_TO.s()).is(null);
		}

		if (!StringUtils.isEmpty(req.getSearchText())) {
			TextCriteria textCriteria = TextCriteria.forDefaultLanguage();
			textCriteria.matching(req.getSearchText());
			textCriteria.caseSensitive(false);
			query.addCriteria(textCriteria);
		}

		query.addCriteria(criteria);
		query.with(Sort.by(Sort.Direction.DESC, SubNode.FIELD_MODIFY_TIME));
		query.limit(MAX_FEED_ITEMS);

		if (req.getPage() > 0) {
			query.skip(MAX_FEED_ITEMS * req.getPage());
		}

		Iterable<SubNode> iter = util.find(query);
		SubNode lastNode = null;

		for (SubNode node : iter) {
			NodeInfo info = convert.convertToNodeInfo(sc, session, node, true, false, counter + 1, false, false);
			searchResults.add(info);
			lastNode = node;
		}

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
		log.debug("search results count: " + counter);
		return res;
	}

	/* todo-0: need to cache this in the session */
	public List<ObjectId> getBlockedUserIds() {
		List<SubNode> nodeList = userManagerService.getSpecialNodesList(null, NodeType.BLOCKED_USERS.s());
		if (nodeList == null)
			return null;
		List<ObjectId> objList = new LinkedList<ObjectId>();
		for (SubNode node : nodeList) {
			String userNodeId = node.getStrProp(NodeProp.USER_NODE_ID.s());
			objList.add(new ObjectId(userNodeId));
		}
		return objList;
	}
}
