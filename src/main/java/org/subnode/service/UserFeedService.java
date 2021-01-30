package org.subnode.service;

import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.apache.commons.lang3.StringUtils;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
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
import org.subnode.mongo.MongoAuth;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.MongoUtil;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.NodeFeedRequest;
import org.subnode.response.FeedPushInfo;
import org.subnode.response.NodeFeedResponse;
import org.subnode.response.ServerPushInfo;
import org.subnode.util.Convert;
import org.subnode.util.ThreadLocals;

/**
 * Service methods for maintaining 'in-memory' lists of the most recent UserFeed posts of all users,
 * to allow extremely fast construction of any person's consolidated feed.
 */
@Component
public class UserFeedService {
	private static final Logger log = LoggerFactory.getLogger(UserFeedService.class);

	static final int MAX_FEED_ITEMS = 50;

	@Autowired
	private MongoRead read;

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
		HashSet<String> usersSharedToSet = new HashSet<String>();
		usersSharedToSet.addAll(usersSharedTo);

		/*
		 * Get a local list of 'allSessions' so we can release the lock on the SessionContent varible
		 * immediately
		 */
		List<SessionContext> allSessions = new LinkedList<SessionContext>();
		synchronized (SessionContext.allSessions) {
			allSessions.addAll(SessionContext.allSessions);
		}

		/* Scan all sessions and push message to the ones that need to see it */
		for (SessionContext sc : allSessions) {

			/* build our push message payload */
			NodeInfo nodeInfo = convert.convertToNodeInfo(sc, session, node, true, false, 1, false, false);
			FeedPushInfo pushInfo = new FeedPushInfo(nodeInfo);

			/* Anonymous sessions won't have userName and can be ignored */
			if (sc.getUserName() == null)
				continue;

			/*
			 * push if the sc user is in the shared set or this session is OURs,
			 */
			if (usersSharedToSet.contains(sc.getUserName())) {
				// push notification message to browser
				sendServerPushInfo(sc, pushInfo);
			}
		}
	}

	public void sendServerPushInfo(SessionContext userSession, ServerPushInfo info) {
		// If user is currently logged in we have a session here.
		if (userSession != null) {
			SseEmitter pushEmitter = userSession.getPushEmitter();
			if (pushEmitter != null) {
				ExecutorService sseMvcExecutor = Executors.newSingleThreadExecutor();
				sseMvcExecutor.execute(() -> {
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
		}
	}

	/*
	 * Generated content of the "Feed" for a user.
	 */
	public NodeFeedResponse generateFeed(MongoSession session, NodeFeedRequest req) {

		NodeFeedResponse res = new NodeFeedResponse();
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}

		int counter = 0;

		/* Finds nodes that have shares to any of the people listed in sharedToAny */
		List<String> sharedToAny = new LinkedList<String>();

		if (req.getToPublic()) {
			sharedToAny.add("public");
		}

		SubNode searchRoot = null;

		// includes shares TO me.
		if (req.getToMe()) {
			if (searchRoot == null) {
				searchRoot = read.getNode(session, ThreadLocals.getSessionContext().getRootId());
			}

			if (searchRoot != null) {
				sharedToAny.add(searchRoot.getOwner().toHexString());
			}
		}
		List<NodeInfo> searchResults = new LinkedList<NodeInfo>();
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

		List<Criteria> orCriteria = new LinkedList<Criteria>();

		if (req.getFromMe()) {
			if (searchRoot == null) {
				searchRoot = read.getNode(session, ThreadLocals.getSessionContext().getRootId());
			}

			if (searchRoot != null) {
				orCriteria.add(
						// where node is owned by us.
						Criteria.where(SubNode.FIELD_OWNER).is(searchRoot.getOwner()) //
								// and the node has any sharing on it.
								.and(SubNode.FIELD_AC).ne(null));
			}
		}

		if (req.getFromFriends()) {
			List<SubNode> friendNodes = userManagerService.getFriendsList(session);
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

		if (!StringUtils.isEmpty(req.getSearchText())) {
			TextCriteria textCriteria = TextCriteria.forDefaultLanguage();
			MongoRead.populateTextCriteria(textCriteria, req.getSearchText());
			textCriteria.caseSensitive(true);
			query.addCriteria(textCriteria);
		}

		query.addCriteria(criteria);
		query.with(Sort.by(Sort.Direction.DESC, SubNode.FIELD_MODIFY_TIME));
		query.limit(MAX_FEED_ITEMS);

		if (req.getPage() > 0) {
			query.skip(MAX_FEED_ITEMS * req.getPage());
		}

		Iterable<SubNode> iter = ops.find(query, SubNode.class);
		for (SubNode node : iter) {
			NodeInfo info = convert.convertToNodeInfo(ThreadLocals.getSessionContext(), session, node, true, false, counter + 1,
					false, false);
			searchResults.add(info);
		}

		if (searchResults.size() < MAX_FEED_ITEMS) {
			res.setEndReached(true);
		}

		res.setSuccess(true);
		log.debug("search results count: " + counter);
		return res;
	}
}
