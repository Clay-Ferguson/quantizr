package org.subnode.service;

import java.util.HashSet;
import java.util.List;
import java.util.concurrent.Executor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter.SseEventBuilder;
import org.subnode.config.SessionContext;
import org.subnode.model.NodeInfo;
import org.subnode.mongo.MongoAuth;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.response.FeedPushInfo;
import org.subnode.response.NodeEditedPushInfo;
import org.subnode.response.ServerPushInfo;
import org.subnode.response.SessionTimeoutPushInfo;
import org.subnode.util.Convert;
import org.subnode.util.ThreadLocals;

@Component
public class PushService {
	private static final Logger log = LoggerFactory.getLogger(PushService.class);

	static final int MAX_FEED_ITEMS = 25;

	@Autowired
	private Convert convert;

	@Autowired
	private MongoAuth auth;

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

			//log.debug("Pushing NODE to SessionContext: hashCode=" + sc.hashCode() + " user=" + sc.getUserName() + " token="
			//		+ sc.getUserToken() + "\nJSON: " + XString.prettyPrint(node));

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
}
