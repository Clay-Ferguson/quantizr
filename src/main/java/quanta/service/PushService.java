package quanta.service;

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
import org.yaml.snakeyaml.scanner.Constant;
import quanta.config.SessionContext;
import quanta.model.NodeInfo;
import quanta.mongo.MongoAuth;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.response.FeedPushInfo;
import quanta.response.NodeEditedPushInfo;
import quanta.response.ServerPushInfo;
import quanta.response.SessionTimeoutPushInfo;
import quanta.util.Convert;
import quanta.util.ThreadLocals;
import static quanta.util.Util.*;

@Component
public class PushService  {
	private static final Logger log = LoggerFactory.getLogger(PushService.class);

	@Autowired
	protected Convert convert;

	@Autowired
	protected MongoAuth auth;

	static final int MAX_FEED_ITEMS = 25;

	@Autowired
	@Qualifier("threadPoolTaskExecutor")
	private Executor executor;

	/* Notify all users being shared to on this node */
	public void pushNodeUpdateToBrowsers(MongoSession ms, HashSet<Integer> sessionsPushed, SubNode node) {
		// log.debug("Pushing update to all friends: id=" + node.getIdStr());

		/* get list of userNames this node is shared to (one of them may be 'public') */
		List<String> usersSharedTo = auth.getUsersSharedTo(ms, node);

		// if node has no sharing we're done here
		if (no(usersSharedTo)) {
			return;
		}

		// put user names in a hash set for faster performance
		HashSet<String> usersSharedToSet = new HashSet<>();
		usersSharedToSet.addAll(usersSharedTo);

		/* Scan all sessions and push message to the ones that need to see it */
		for (SessionContext sc : SessionContext.getAllSessions()) {
			// if we know we already just pushed to this session, we can skip it in here.
			if (ok(sessionsPushed) && sessionsPushed.contains(sc.hashCode())) {
				continue;
			}

			/* Anonymous sessions won't have userName and can be ignored */
			if (no(sc.getUserName()))
				continue;

			/* build our push message payload */
			NodeInfo nodeInfo = convert.convertToNodeInfo(sc, ms, node, true, false, 1, false, false, true, false);
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
	public void pushNodeToMonitoringBrowsers(MongoSession ms, HashSet<Integer> sessionsPushed, SubNode node) {
		// log.debug("Push to monitoring Browsers: node.content=" + node.getContent());

		/* Scan all sessions and push message to the ones that need to see it */
		for (SessionContext sc : SessionContext.getAllSessions()) {
			/* Anonymous sessions won't have userName and can be ignored */
			if (no(sc.getUserName()))
				continue;

			// log.debug("Pushing NODE to SessionContext: hashCode=" + sc.hashCode() + " user=" +
			// sc.getUserName() + " token="
			// + sc.getUserToken() + "\nJSON: " + XString.prettyPrint(node));

			// if this node starts with the 'watchingPath' of the user that means the node is a descendant of
			// the watching path
			if (ok(node.getPath()) && ok(sc.getWatchingPath()) && node.getPath().startsWith(sc.getWatchingPath())) {

				/* build our push message payload */
				NodeInfo nodeInfo = convert.convertToNodeInfo(sc, ms, node, true, false, 1, false, false, true, false);
				FeedPushInfo pushInfo = new FeedPushInfo(nodeInfo);

				// push notification message to browser
				sendServerPushInfo(sc, pushInfo);

				if (ok(sessionsPushed)) {
					sessionsPushed.add(sc.hashCode());
				}
			}
		}
	}

	/* Notify all browser timelines if they have new info */
	public void pushTimelineUpdateToBrowsers(MongoSession ms, NodeInfo nodeInfo) {
		/* Scan all sessions and push message to the ones that need to see it */
		for (SessionContext sc : SessionContext.getAllSessions()) {
			/* Anonymous sessions can be ignored */
			if (no(sc.getUserName()))
				continue;

			/*
			 * Nodes whose path starts with "timeline path", are subnodes of (or descendants of) the timeline
			 * node and therefore will be sent to their respecitve browsers
			 */
			if (no(sc.getTimelinePath()) || !nodeInfo.getPath().startsWith(sc.getTimelinePath())) {
				continue;
			}

			NodeEditedPushInfo pushInfo = new NodeEditedPushInfo(nodeInfo);
			sendServerPushInfo(sc, pushInfo);
		}
	}

	public void sendServerPushInfo(SessionContext sc, ServerPushInfo info) {
		// If user is currently logged in we have a session here.
		if (no(sc))
			return;

		executor.execute(() -> {
			SseEmitter pushEmitter = sc.getPushEmitter();
			if (no(pushEmitter))
				return;

			synchronized (pushEmitter) {
				log.debug("Pushing to User: " + sc.getUserName());
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
					log.debug("Pushed ok");
				} catch (Exception ex) {
					log.error("FAILED Pushing to Session User: " + sc.getUserName());
					pushEmitter.completeWithError(ex);
				} finally {
					// todo-1: this can be done in a slightly cleaner way (more decoupled)
					if (info instanceof SessionTimeoutPushInfo) {
						ThreadLocals.setMongoSession(null);
						sc.setLive(false);
						sc.setRootId(null);
						sc.setUserName(null);
					}
				}
			}
		});
	}
}
