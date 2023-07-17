package quanta.service;

import java.util.HashSet;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter.SseEventBuilder;
import com.fasterxml.jackson.databind.ObjectMapper;
import quanta.config.ServiceBase;
import quanta.config.SessionContext;
import quanta.model.NodeInfo;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.redis.RedisBrowserPushInfo;
import quanta.response.FeedPushInfo;
import quanta.response.ServerPushInfo;
import quanta.util.Convert;
import quanta.util.ThreadLocals;
import quanta.util.XString;

@Component
public class PushService extends ServiceBase {

    public static final ObjectMapper jsonMapper = new ObjectMapper();

    private static Logger log = LoggerFactory.getLogger(PushService.class);
    static final int MAX_FEED_ITEMS = 25;

    /* Notify all users being shared to on this node, or everyone if the node is public. */
    public void pushNodeUpdateToBrowsers(MongoSession ms, HashSet<String> sessionsPushed, SubNode node) {
        // if unpublished or not a comment don't push to browsers.
        if (node.getBool(NodeProp.UNPUBLISHED) || !node.getType().equals(NodeType.COMMENT.s()))
            return;

        exec.run(() -> {
            boolean isPublic = AclService.isPublic(node);
            // put user names in a hash set for faster performance
            HashSet<String> usersSharedToSet = new HashSet<>();

            List<String> usersSharedTo = auth.getUsersSharedTo(ms, node);
            usersSharedToSet.addAll(usersSharedTo);

            // if not public or shared to anyone we're done.
            if (!isPublic && usersSharedToSet.size() == 0)
                return;

            maybePushToBrowser(ms, sessionsPushed, node, usersSharedToSet, isPublic, ThreadLocals.getSC());

            List<SessionContext> scList = redis.query("*");
            if (scList.size() > 0) {
                for (SessionContext sc : scList) {
                    // skip our own session because we already considered it first, above.
                    if (ThreadLocals.getSC() != null && sc.getUserToken().equals(ThreadLocals.getSC().getUserToken()))
                        continue;

                    // log.debug("Maybe Pushing to user: " + sc.getUserName() + " sc.hashCode=" + sc.hashCode()
                    // + " token: " + sc.getUserToken());
                    maybePushToBrowser(ms, sessionsPushed, node, usersSharedToSet, isPublic, sc);
                }
            }
        });
    }

    private void maybePushToBrowser(MongoSession ms, HashSet<String> sessionsPushed, SubNode node,
            HashSet<String> usersSharedToSet, boolean isPublic, SessionContext sc) {
        // if we know we already just pushed to this session, we can skip it in here.
        if (sessionsPushed != null && sessionsPushed.contains(sc.getUserToken())) {
            return;
        }

        /* Anonymous sessions won't have userName and can be ignored */
        if (sc == null || sc.getUserName() == null)
            return;

        /*
         * We send a push to all users who are monitoring this node or any ancestor of it. This will be the
         * users who have opened some ancestor node as their "Feed Node" (viewing feed of that specific
         * node. This means 'viewing that node as a chat room')
         *
         * Nodes whose path starts with "timeline path", are subnodes of (or descendants of) the timeline
         * node and therefore will be sent to their respecitve browsers
         */
        if (
        // We don't include isPublic here, because we want don't want every message that comes into the
        // server to show up right away on the feed. We expect user to 'refresh' for that.
        // isPublic || // node is public
        node.getOwner().toHexString().equals(sc.getRootId()) // is my node
                || (sc.getWatchingPath() != null && node.getPath().startsWith(sc.getWatchingPath()))
                || (sc.getTimelinePath() != null && node.getPath().startsWith(sc.getTimelinePath()))
                || (usersSharedToSet != null && usersSharedToSet.contains(sc.getUserName()))) {
            pushToBrowser(ms, sc, sessionsPushed, node);
        }
    }

    public void pushToBrowser(MongoSession ms, SessionContext sc, HashSet<String> sessionsPushed, SubNode node) {
        if (sessionsPushed != null && sessionsPushed.contains(sc.getUserToken())) {
            return;
        }

        /* build our push message payload */
        NodeInfo info = convert.convertToNodeInfo(false, sc, ms, node, false, Convert.LOGICAL_ORDINAL_IGNORE, false,
                false, false, true, true, null, false);

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
        if (sc == null)
            return;

        // look for an SseEmitter on this replia, which may or may not exist. We might not be the replica
        // that the browser is connected to for it's SseEmittre
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
                FeedPushInfo info = jsonMapper.readValue(rinfo.getPayload(), FeedPushInfo.class);
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
            /*
             * Note: Each session has it's own pushEmitter, so this will not be a bottleck, and is desirable
             * even probably to be sure each session is only doing one emit at a time.
             */
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
