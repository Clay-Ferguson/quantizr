package quanta.service;

import java.util.HashSet;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter.SseEventBuilder;
import quanta.config.ServiceBase;
import quanta.config.SessionContext;
import quanta.model.NodeInfo;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.redis.RedisBrowserPushInfo;
import quanta.rest.response.FeedPushInfo;
import quanta.rest.response.ServerPushInfo;
import quanta.util.Convert;
import quanta.util.ThreadLocals;
import quanta.util.Util;
import quanta.util.XString;

@Component
public class PushService extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(PushService.class);
    static final int MAX_FEED_ITEMS = 25;

    /*
     * Notify all users being shared to on this node, or everyone if the node is public.
     */
    public void pushNodeUpdateToBrowsers(MongoSession as, HashSet<String> sessionsPushed, SubNode node) {
        exec.run(() -> {
            boolean isPublic = AclService.isPublic(node);
            // put user names in a hash set for faster performance
            HashSet<String> usersSharedToSet = new HashSet<>();

            List<String> usersSharedTo = auth.getUsersSharedTo(as, node);
            if (usersSharedTo != null) {
                usersSharedToSet.addAll(usersSharedTo);
            }

            // if not public or shared to anyone we're done.
            if (!isPublic && usersSharedToSet.size() == 0)
                return;

            maybePushToBrowser(as, sessionsPushed, node, usersSharedToSet, isPublic, ThreadLocals.getSC());

            List<SessionContext> scList = redis.query("*");
            if (scList.size() > 0) {
                for (SessionContext sc : scList) {
                    // skip our own session because we already considered it first, above.
                    if (ThreadLocals.getSC() != null && sc.getUserToken().equals(ThreadLocals.getSC().getUserToken()))
                        continue;

                    // log.debug("Maybe Pushing to user: " + sc.getUserName() + " sc.hashCode=" + sc.hashCode()
                    // + " token: " + sc.getUserToken());
                    maybePushToBrowser(as, sessionsPushed, node, usersSharedToSet, isPublic, sc);
                }
            }
        });
    }

    private void maybePushToBrowser(MongoSession as, HashSet<String> sessionsPushed, SubNode node,
            HashSet<String> usersSharedToSet, boolean isPublic, SessionContext sc) {
        // if we know we already just pushed to this session, we can skip it in here.
        if (sessionsPushed != null && sessionsPushed.contains(sc.getUserToken())) {
            return;
        }

        // Anonymous sessions won't have userName and can be ignored
        if (sc == null || sc.getUserName() == null)
            return;

        // if 'sc' is my session and 'node' is my node, then push to my browser and return
        if (node.getOwner().toHexString().equals(sc.getUserNodeId()) && ThreadLocals.getSC() != null
                && sc.getUserToken().equals(ThreadLocals.getSC().getUserToken())) {
            pushToBrowser(as, sc, sessionsPushed, node);
            return;
        }

        // if user has no kind of live updateable view, or we know based on path this won't be shown in
        // the timeline then return
        if (!sc.isViewingFeed() && (sc.getTimelinePath() == null || !node.getPath().startsWith(sc.getTimelinePath())))
            return;

        if (auth.ownedBy(sc, node)) {
            pushToBrowser(as, sc, sessionsPushed, node);
        }
        // Nodes whose path starts with "timeline path", are subnodes of (or descendants of) the timeline
        // node and therefore will be sent to their respecitve browsers
        else if (sc.getTimelinePath() != null && node.getPath().startsWith(sc.getTimelinePath())) {
            if (node.getOwner().toHexString().equals(sc.getUserNodeId()) // is my node
                    || AclService.isPublic(node) // is public node
                    || (usersSharedToSet != null && usersSharedToSet.contains(sc.getUserName())) // shared to me
            ) {
                pushToBrowser(as, sc, sessionsPushed, node);
            }
        }
    }

    public void pushToBrowser(MongoSession ms, SessionContext sc, HashSet<String> sessionsPushed, SubNode node) {
        if (sessionsPushed != null && sessionsPushed.contains(sc.getUserToken())) {
            return;
        }

        // build our push message payload
        NodeInfo info = convert.toNodeInfo(false, sc, ms, node, false, Convert.LOGICAL_ORDINAL_IGNORE, false, false,
                false, true, null);

        if (info != null) {
            FeedPushInfo pushInfo = new FeedPushInfo(info);
            // push notification message to browser
            push.pushInfo(sc, pushInfo);

            if (sessionsPushed != null) {
                sessionsPushed.add(sc.getUserToken());
            }
        }
    }

    public void pushInfo(SessionContext sc, ServerPushInfo info) {
        // If user is currently logged in we have a session here.
        if (sc == null) {
            log.error("sc is null");
            return;
        }

        if (sc.getUserToken() == null) {
            log.error("sc.userToken is null");
            return;
        }

        // look for an SseEmitter on this replica, which may or may not exist. We might not be the replica
        // that the browser is connected to for it's SseEmittre
        if (UserManagerService.pushEmitters == null) {
            log.error("pushEmitters is null");
            return;
        }

        if (UserManagerService.pushEmitters.isEmpty()) {
            log.error("pushEmitters isEmpty");
            return;
        }
        SseEmitter emitter = UserManagerService.pushEmitters.get(sc.getUserToken());

        // if we happened to be the right replica to push to browser, then push
        if (emitter != null) {
            // log.debug("PUSHING: we have the emitter in replica: " + prop.getSwarmTaskSlot());
            pushInfo(sc.getUserToken(), info);
        }
        // else we post to Redis PubSub to let the correct replica push this to the browser for us
        else {
            // log.debug("PUSH Queued via Redis PubSub");
            RedisBrowserPushInfo msg =
                    new RedisBrowserPushInfo(sc.getUserToken(), XString.compactPrint(info), info.getClass().getName());
            redis.publish(msg);
        }
    }

    public void maybePushToBrowser(RedisBrowserPushInfo rinfo) {
        SseEmitter emitter = UserManagerService.pushEmitters.get(rinfo.getToken());

        // if we happened to be the right replica to push to browser, then push
        if (emitter != null) {
            // log.debug("Message handled by replica " + prop.getSwarmTaskSlot() + ": "
            // + XString.prettyPrint(rinfo));
            try {
                FeedPushInfo info = Util.simpleMapper.readValue(rinfo.getPayload(), FeedPushInfo.class);
                pushInfo(rinfo.getToken(), info);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }
    }

    public void pushInfo(String token, ServerPushInfo info) {
        exec.run(() -> {
            SessionContext sc = redis.get(token);
            if (sc == null) {
                throw new RuntimeException("bad token for push emitter: " + token);
            }
            SseEmitter pushEmitter = user.getPushEmitter(token);
            if (pushEmitter == null) {
                log.debug("No PushEmitter for token: " + token);
                return;
            }
            // Note: Each session has it's own pushEmitter, so this will not be a bottleck, and is desirable
            // even probably to be sure each session is only doing one emit at a time.
            synchronized (pushEmitter) {
                try {
                    SseEventBuilder event =
                            SseEmitter.event().data(info).id(String.valueOf(info.hashCode())).name(info.getType());
                    pushEmitter.send(event);
                } catch (Exception ex) {
                    log.error("FAILED Pushing to Session with token: " + token);
                    pushEmitter.completeWithError(ex);
                }
            }
        });
    }
}
