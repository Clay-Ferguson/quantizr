package org.subnode.service;

import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter.SseEventBuilder;
import org.subnode.config.NodeName;
import org.subnode.config.SessionContext;
import org.subnode.model.NodeInfo;
import org.subnode.model.client.NodeType;
import org.subnode.model.client.PrincipalName;
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

	static final int MAX_FEED_ITEMS = 200;

	@Autowired
	private MongoRead read;

	@Autowired
	private Convert convert;

	@Autowired
	private SessionContext sessionContext;

	@Autowired
	private MongoAuth auth;

	@Autowired
	private MongoUtil util;

	@Autowired
	private MongoTemplate ops;

	/* Notify all users being shared to on this node */
	public void pushNodeUpdateToBrowsers(MongoSession session, SubNode node) {
		log.debug("Pushing update to all friends: from user " + sessionContext.getUserName() + ": id="
				+ node.getId().toHexString());

		/* get list of userNames this node is shared to (one of them may be 'public') */
		List<String> usersSharedTo = auth.getUsersSharedTo(session, node);

		// if node has no sharing we're done here
		if (usersSharedTo == null) {
			return;
		}

		// put user names in a hash set for faster performance
		HashSet<String> usersSharedToSet = new HashSet<String>();
		usersSharedToSet.addAll(usersSharedTo);

		boolean isPublic = usersSharedToSet.contains(PrincipalName.PUBLIC.s());

		/*
		 * Get a local list of 'allSessions' so we can release the lock on the SessionContent varible
		 * immediately
		 */
		List<SessionContext> allSessions = new LinkedList<SessionContext>();
		synchronized (SessionContext.allSessions) {
			allSessions.addAll(SessionContext.allSessions);
		}

		/* build out push message payload */
		NodeInfo nodeInfo = convert.convertToNodeInfo(sessionContext, session, node, true, false, 1, false, false);
		FeedPushInfo pushInfo = new FeedPushInfo(nodeInfo);

		/* Scan all sessions and push message to the ones that need to see it */
		for (SessionContext sc : allSessions) {

			/* Anonymous sessions won't have userName and can be ignored */
			if (sc.getUserName() == null)
				continue;

			/*
			 * push if...
			 * 
			 * 1) node is shared to public or
			 * 
			 * 2) the sc user is in the shared set or
			 * 
			 * 3) this session is OURs,
			 */
			if (isPublic || //
					usersSharedToSet.contains(sc.getUserName()) || //
					sc.getUserName().equals(sessionContext.getUserName())) {

				// push notification message to browser
				sendServerPushInfo(sc, pushInfo);
			}
		}
	}

	public void sendServerPushInfo(SessionContext userSession, ServerPushInfo info) {
		// SessionContext userSession = SessionContext.getSessionByUserName(recipientUserName);

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
		List<String> sharedToAny = new LinkedList<String>();

		if (req.getToPublic()) {
			sharedToAny.add("public");
		}

		SubNode searchRoot = read.getNode(session, sessionContext.getRootId());

		// includes shares TO me.
		if (req.getToMe()) {
			sharedToAny.add(searchRoot.getOwner().toHexString());
		}
		List<NodeInfo> searchResults = new LinkedList<NodeInfo>();
		res.setSearchResults(searchResults);

		String pathToSearch = NodeName.ROOT_OF_ALL_USERS;

		Query query = new Query();
		Criteria criteria = Criteria.where(SubNode.FIELD_PATH).regex(util.regexRecursiveChildrenOfPath(pathToSearch));

		List<Criteria> orCriteria = new LinkedList<Criteria>();

		if (req.getFromMe()) {
			orCriteria.add(
					// where node is owned by us.
					Criteria.where(SubNode.FIELD_OWNER).is(searchRoot.getOwner()) //
							// and the node has any sharing on it.
							.and(SubNode.FIELD_AC).ne(null));
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

		query.addCriteria(criteria);
		query.with(Sort.by(Sort.Direction.DESC, SubNode.FIELD_MODIFY_TIME));
		query.limit(MAX_FEED_ITEMS);

		Iterable<SubNode> iter = ops.find(query, SubNode.class);
		for (SubNode node : iter) {

			/*
			 * We don't want FRIEND nodes in the feed, but I'm not sure if there will be a more 'generic'
			 * encompassing way to filter out unwanted records here. I don't want this done by the DB query for
			 * now
			 */
			if (NodeType.FRIEND.s().equals(node.getType()) || //
					NodeType.POSTS.s().equals(node.getType())) {
				continue;
			}

			NodeInfo info = convert.convertToNodeInfo(sessionContext, session, node, true, false, counter + 1, false, false);
			searchResults.add(info);
		}

		res.setSuccess(true);
		log.debug("search results count: " + counter);
		return res;
	}

	// unused (but I want to keep for an example)
	public List<SubNode> sortAndTruncateFeedItems(List<SubNode> list) {
		/* Sort the feed items chrononologially, reversed with newest on top */
		Collections.sort(list, new Comparator<SubNode>() {
			@Override
			public int compare(SubNode s1, SubNode s2) {
				return s2.getModifyTime().compareTo(s1.getModifyTime());
			}
		});

		/* Truncate list down to max length */
		if (list.size() > MAX_FEED_ITEMS) {
			list = list.subList(0, MAX_FEED_ITEMS - 1);
		}
		return list;
	}
}
