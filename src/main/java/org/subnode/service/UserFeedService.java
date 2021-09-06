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
import org.subnode.response.FeedPushInfo;
import org.subnode.response.NodeEditedPushInfo;
import org.subnode.response.NodeFeedResponse;
import org.subnode.response.ServerPushInfo;
import org.subnode.response.SessionTimeoutPushInfo;
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
	@Qualifier("threadPoolTaskExecutor")
	private Executor executor;

	/* Notify all users being shared to on this node */
	public void pushNodeUpdateToBrowsers(MongoSession session, HashSet<Integer> sessionsPushed, SubNode node) {
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

		/* Scan all sessions and push message to the ones that need to see it */
		for (SessionContext sc : SessionContext.getAllSessions()) {
			// if we know we already just pushed to this session, we can skip it in here.
			if (sessionsPushed != null && sessionsPushed.contains(sc.hashCode())) {
				continue;
			}

			/* Anonymous sessions won't have userName and can be ignored */
			if (sc.getUserName() == null)
				continue;

			/* build our push message payload */
			NodeInfo nodeInfo = convert.convertToNodeInfo(sc, session, node, true, false, 1, false, false, true, false);
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

	/*
	 * Send a push to all users who are monitoring this node or any ancestor of it. This will be the
	 * users who have opened some ancestor node as their "Feed Node" (viewing feed of that specific
	 * node)
	 */
	public void pushNodeToMonitoringBrowsers(MongoSession session, HashSet<Integer> sessionsPushed, SubNode node) {
		// log.debug("Push to monitoring Browsers: node.content=" + node.getContent());

		/* Scan all sessions and push message to the ones that need to see it */
		for (SessionContext sc : SessionContext.getAllSessions()) {
			/* Anonymous sessions won't have userName and can be ignored */
			if (sc.getUserName() == null)
				continue;

			// log.debug("Pushing to SessionContext: hashCode=" + sc.hashCode() + " user=" + sc.getUserName() + " token="
			// 		+ sc.getUserToken());

			// if this node starts with the 'watchingPath' of the user that means the node is a descendant of
			// the watching path
			if (node.getPath() != null && sc.getWatchingPath() != null && node.getPath().startsWith(sc.getWatchingPath())) {

				/* build our push message payload */
				NodeInfo nodeInfo = convert.convertToNodeInfo(sc, session, node, true, false, 1, false, false, true, false);
				FeedPushInfo pushInfo = new FeedPushInfo(nodeInfo);

				// push notification message to browser
				sendServerPushInfo(sc, pushInfo);

				if (sessionsPushed != null) {
					sessionsPushed.add(sc.hashCode());
				}
			}
		}
	}

	/* Notify all browser timelines if they have new info */
	public void pushTimelineUpdateToBrowsers(MongoSession session, NodeInfo nodeInfo) {
		/* Scan all sessions and push message to the ones that need to see it */
		for (SessionContext sc : SessionContext.getAllSessions()) {
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

	public void sendServerPushInfo(SessionContext sc, ServerPushInfo info) {
		// If user is currently logged in we have a session here.
		if (sc == null)
			return;

		executor.execute(() -> {
			SseEmitter pushEmitter = sc.getPushEmitter();
			if (pushEmitter == null)
				return;

			synchronized (pushEmitter) {
				// log.debug("Pushing to Session User: " + sc.getUserName());
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
				} finally {
					// todo-1: this can be done in a slightly cleaner way (more decoupled)
					if (info instanceof SessionTimeoutPushInfo) {
						ThreadLocals.setMongoSession(null);
						sc.setLive(false);
						sc.setRootId(null);
						sc.setUserName(null);
						sc.setPushEmitter(null);
					}
				}
			}
		});
	}

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
	 */
	public NodeFeedResponse generateFeed(MongoSession session, NodeFeedRequest req) {
		SessionContext sc = ThreadLocals.getSC();
		NodeFeedResponse res = new NodeFeedResponse();
		session = ThreadLocals.ensure(session);

		String pathToSearch = NodeName.ROOT_OF_ALL_USERS;
		boolean doAuth = true;
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
					auth.auth(session, rootNode, PrivilegeType.READ);
				} catch (Exception e) {
					sc.setWatchingPath(null);
					throw e;
				}
			}
			// Then we set the public chat to indicate to the rest of the code below not do do any
			// further authorization.
			doAuth = false;
			sc.setWatchingPath(pathToSearch);

		} else {
			sc.setWatchingPath(null);
		}

		int counter = 0;

		/* Query will include nodes that have shares to any of the people listed in sharedToAny */
		List<String> sharedToAny = new LinkedList<>();

		if (doAuth && req.getToPublic()) {
			sharedToAny.add(PrincipalName.PUBLIC.s());
		}

		SubNode myAcntNode = null;

		// includes shares TO me.
		if (doAuth && req.getToMe()) {
			if (myAcntNode == null) {
				myAcntNode = read.getNode(session, sc.getRootId());
			}

			if (myAcntNode != null) {
				sharedToAny.add(myAcntNode.getOwner().toHexString());

				/*
				 * setting last active time to this current time, will stop the GUI from showing the user an
				 * indication that they have new messages, because we know they're querying messages NOW, so this is
				 * a way to reset
				 */
				myAcntNode.setProp(NodeProp.LAST_ACTIVE_TIME.s(), sc.getLastActiveTime());
				update.save(session, myAcntNode);
			}
		}
		List<NodeInfo> searchResults = new LinkedList<>();
		res.setSearchResults(searchResults);

		Query query = new Query();
		List<Criteria> ands = new LinkedList<>();
		Criteria criteria = Criteria.where(SubNode.FIELD_PATH).regex(util.regexRecursiveChildrenOfPath(pathToSearch)); //

		if (req.getNodeId() == null) {
			// This 'andOperator' pattern is what is required when you have multiple conditions added to a
			// single field.
			ands.add(Criteria.where(SubNode.FIELD_TYPE).ne(NodeType.FRIEND.s()));//
			ands.add(Criteria.where(SubNode.FIELD_TYPE).ne(NodeType.POSTS.s())); //
			ands.add(Criteria.where(SubNode.FIELD_TYPE).ne(NodeType.ACT_PUB_POSTS.s()));
		}

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

		getBlockedUserIds(blockedUserIds);
		if (blockedUserIds.size() > 0) {
			criteria = criteria.and(SubNode.FIELD_OWNER).nin(blockedUserIds);
		}

		/*
		 * Save the 'string' representations for use below, so mask out places where users may be following
		 * a user that will effectively be blocked
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

		List<Criteria> orCriteria = new LinkedList<>();

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
				for (SubNode friendNode : friendNodes) {

					// the USER_NODE_ID property on friends nodes contains the actual account ID of this friend.
					String userNodeId = friendNode.getStrProp(NodeProp.USER_NODE_ID);

					// if we have a userNodeId and they aren't in the blocked list.
					if (userNodeId != null && !blockedIdStrings.contains(userNodeId)) {
						orCriteria.add(Criteria.where(SubNode.FIELD_OWNER).is(new ObjectId(userNodeId)));
					}
				}
			}
		}

		if (doAuth) {
			// or a node that is shared to any of the sharedToAny users
			for (String share : sharedToAny) {
				orCriteria.add(Criteria.where(SubNode.FIELD_AC + "." + share).ne(null));
			}
		}

		if (orCriteria.size() > 0) {
			ands.add(new Criteria().orOperator((Criteria[]) orCriteria.toArray(new Criteria[orCriteria.size()])));
		}

		// Only one andOperator call is allowed so we accumulate 'ands' in the list before using.
		if (ands.size() > 0) {
			criteria.andOperator(ands);
		}

		// use attributedTo proptery to determine whether a node is 'local' (posted by this server) or not.
		if (req.getLocalOnly()) {
			// note: the ".value" part is recently added, but actually since this is a compare to null should
			// not be needed.
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
