package org.subnode.service;

import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter.SseEventBuilder;
import org.subnode.config.SessionContext;
import org.subnode.model.NodeInfo;
import org.subnode.mongo.MongoAuth;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.RunAsMongoAdminEx;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.NodeFeedRequest;
import org.subnode.response.FeedPushInfo;
import org.subnode.response.NodeFeedResponse;
import org.subnode.response.ServerPushInfo;
import org.subnode.util.Convert;
import org.subnode.util.ThreadLocals;

/**
 * Service methods for maintaining 'in-memory' lists of the most recent UserFeed
 * posts of all users, to allow extremely fast construction of any person's
 * consolidated feed.
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
	private ActPubService actPubService;

	@Autowired
	private SessionContext sessionContext;

	@Autowired
	private MongoAuth auth;

	/* Notify all users being shared to on this node */
	public void pushNodeUpdateToAllFriends(MongoSession session, SubNode node) {
		log.debug("Pushing update to all friends: from user " + sessionContext.getUserName() + ": id="
				+ node.getId().toHexString());
		Set<String> loggedInUserNames = null;
		List<String> usersSharedTo = auth.getUsersSharedTo(session, node);

		// if node has no sharing we're done here
		if (usersSharedTo == null) {
			return;
		}

		/*
		 * all we do in this synchronized block is get keys because we need to release
		 * this lock FAST since it has the effect of making logins or other critical
		 * processes block while locked
		 */
		synchronized (SessionContext.sessionsByUserName) {
			loggedInUserNames = SessionContext.sessionsByUserName.keySet();
		}

		NodeInfo nodeInfo = convert.convertToNodeInfo(sessionContext, session, node, true, false, 1, false, false);
		FeedPushInfo pushInfo = new FeedPushInfo(nodeInfo);
		/*
		 * Iterate all the users the node is shared to, and for any that are logged in
		 * send a server push
		 */
		for (String userName : usersSharedTo) {
			if (loggedInUserNames.contains(userName)) {
				SessionContext sc = SessionContext.sessionsByUserName.get(userName);
				if (sc != null) {
					sendServerPushInfo(sc.getUserName(), pushInfo);
				}
			}
		}

		// push to ourselves to cause our own Feed window to update
		sendServerPushInfo(sessionContext.getUserName(), pushInfo);
	}

	public void sendServerPushInfo(String recipientUserName, ServerPushInfo info) {
		SessionContext userSession = SessionContext.getSessionByUserName(recipientUserName);

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
						 * DO NOT DELETE. This way of sending also works, and I was originally doing it
						 * this way and picking up in eventSource.onmessage = e => {} on the browser,
						 * but I decided to use the builder instead and let the 'name' in the builder
						 * route different objects to different event listeners on the client. Not
						 * really sure if either approach has major advantages over the other.
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
	 * New version of this just does a global query for all nodes that are shared to
	 * this user (todo-0: Also eventually we will bring back the
	 * "only friends I'm following" option to this query, using the two props in the
	 * request for the filtering options but be VERY careful not to expose data
	 * without 'auth', when you do a wider search.)
	 */
	public NodeFeedResponse generateFeed(MongoSession session, NodeFeedRequest req) {

		NodeFeedResponse res = new NodeFeedResponse();
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}

		List<SubNode> nodes = new LinkedList<SubNode>();
		int counter = 0;

		// DO NOT DELETE. This pattern of code with BLOCKED_USERS instead of FRIEND_LIST
		// will eventually be used to allow us to block users in feeds.
		//
		// if ("friends".equals(req.getUserFilter())) {
		// 	List<String> followedUserNodeIds = new LinkedList<String>();

		// 	SubNode userNode = read.getUserNodeByUserName(session, null);
		// 	if (userNode == null)
		// 		return res;

		// 	SubNode friendsNode = read.findTypedNodeUnderPath(session, userNode.getPath(), NodeType.FRIEND_LIST.s());
		// 	if (friendsNode == null)
		// 		return res;

		// 	for (SubNode friendNode : read.getChildren(session, friendsNode, null, null, 0)) {
		// 		String userNodeId = friendNode.getStrProp(NodeProp.USER_NODE_ID.s());
		// 		followedUserNodeIds.add(userNodeId);
		// 	}
		// }

		for (SubNode node : auth.searchSubGraphByAclUser(session, null, sessionContext.getRootId(), SubNode.FIELD_MODIFY_TIME, MAX_FEED_ITEMS)) {
			nodes.add(node);
			if (counter++ > MAX_FEED_ITEMS) {
				break;
			}
		}

		/*
		 * Now add all the nodes that are shared BY this user to other users. Should be
		 * no overlap with previous query results (code just above this)
		 */
		SubNode searchRoot = read.getNode(session, sessionContext.getRootId());
		for (SubNode node : auth.searchSubGraphByAcl(session, null, searchRoot.getOwner(), SubNode.FIELD_MODIFY_TIME,
				MAX_FEED_ITEMS)) {
			nodes.add(node);
		}

		// sort and truncate merged list into final list before converting all
		nodes = sortAndTruncateFeedItems(nodes);

		List<NodeInfo> searchResults = new LinkedList<NodeInfo>();
		res.setSearchResults(searchResults);
		counter = 0;
		for (SubNode node : nodes) {
			NodeInfo info = convert.convertToNodeInfo(sessionContext, session, node, true, false, counter + 1, false,
					false);
			searchResults.add(info);
		}

		res.setSuccess(true);
		log.debug("search results count: " + counter);
		return res;
	}

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
