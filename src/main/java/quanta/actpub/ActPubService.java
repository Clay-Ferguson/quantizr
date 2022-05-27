package quanta.actpub;

import static quanta.actpub.model.AP.apBool;
import static quanta.actpub.model.AP.apDate;
import static quanta.actpub.model.AP.apList;
import static quanta.actpub.model.AP.apObj;
import static quanta.actpub.model.AP.apStr;
import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.security.PublicKey;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Calendar;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import javax.servlet.http.HttpServletRequest;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import quanta.AppController;
import quanta.actpub.model.APList;
import quanta.actpub.model.APOLike;
import quanta.actpub.model.APOMention;
import quanta.actpub.model.APObj;
import quanta.actpub.model.APType;
import quanta.config.NodeName;
import quanta.config.ServiceBase;
import quanta.instrument.PerfMon;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.model.client.PrincipalName;
import quanta.model.client.PrivilegeType;
import quanta.mongo.CreateNodeLocation;
import quanta.mongo.MongoRepository;
import quanta.mongo.MongoSession;
import quanta.mongo.MongoUtil;
import quanta.mongo.model.AccessControl;
import quanta.mongo.model.FediverseName;
import quanta.mongo.model.SubNode;
import quanta.service.NodeSearchService;
import quanta.util.DateUtil;
import quanta.util.ThreadLocals;
import quanta.util.Util;
import quanta.util.XString;

/**
 * General AP functions
 */
@Component
public class ActPubService extends ServiceBase {
    private static final Logger log = LoggerFactory.getLogger(ActPubService.class);

    @Autowired
    private ActPubLog apLog;

    public static final boolean ENGLISH_LANGUAGE_CHECK = false;
    public static final int MAX_MESSAGES = 10;
    public static final int MAX_FOLLOWERS = 20;
    public static int outboxQueryCount = 0;
    public static int cycleOutboxQueryCount = 0;
    public static int newPostsInCycle = 0;
    public static int accountsRefreshed = 0;
    public static int refreshForeignUsersCycles = 0;
    public static int refreshForeignUsersQueuedCount = 0;
    public static String lastRefreshForeignUsersCycleTime = "n/a";
    public static int inboxCount = 0;
    public static boolean userRefresh = false;
    public static boolean bigRefresh = false;

    public void sendLikeMessage(MongoSession ms, String userDoingLike, SubNode node) {
        exec.run(() -> {
            SubNode likedAccount = read.getNode(ms, node.getOwner());

            String inbox = likedAccount.getStr(NodeProp.ACT_PUB_ACTOR_INBOX);
            if (no(inbox)) {
                throw new RuntimeException("No inbox for owner of node: " + node.getIdStr());
            }

            // update cache just because we can
            apCache.inboxesByUserName.put(likedAccount.getStr(NodeProp.USER.s()), inbox);

            // foreign ID of node being liked
            String apId = node.getStr(NodeProp.ACT_PUB_ID);

            // the like needs to go out at least to this actorId
            String toActorId = node.getStr(NodeProp.ACT_PUB_OBJ_ATTRIBUTED_TO);

            String fromActor = apUtil.makeActorUrlForUserName(userDoingLike);

            List<String> toUserNames = new LinkedList<String>();
            toUserNames.add(toActorId);

            APOLike message = apFactory.newLike(node.getIdStr() + "-like", apId, fromActor, toUserNames, null);
            // log.debug("Sending Like message: "+XString.prettyPrint(message));

            String privateKey = apCrypto.getPrivateKey(ms, userDoingLike);
            apUtil.securePostEx(inbox, privateKey, fromActor, message, APConst.MTYPE_LD_JSON_PROF);
        });
    }

    /*
     * When 'node' has been created under 'parent' (by the sessionContext user) this will send a
     * notification to foreign servers. This call returns immediately and delegates the actuall
     * proccessing to a daemon thread.
     * 
     * For concurrency reasons, note that we pass in the nodeId to this method rather than the node even
     * if we do have the node, because we want to make sure there's no concurrent access.
     * 
     * IMPORTANT: This method ONLY sends notifications to users who ARE in the 'acl' which means these
     * can only be users ALREADY imported into the system, however this is ok, because we will have
     * called saveMentionsToNodeACL() right before calling this method so the 'acl' should completely
     * contain all the mentions that exist in the text of the message.
     * 
     */
    public void sendActPubForNodeEdit(MongoSession ms, String inReplyTo, String replyToType, HashMap<String, AccessControl> acl,
            APList attachments, String content, String objUrl, String boostTarget) {
        exec.run(() -> {
            try {
                HashSet<String> toUserNames = new HashSet<>();
                boolean privateMessage = true;

                /*
                 * Lookup all userNames from the ACL info, to add them all to 'toUserNames'
                 */
                for (String accntId : acl.keySet()) {
                    if (PrincipalName.PUBLIC.s().equals(accntId)) {
                        privateMessage = false;
                    } else {
                        // try to get account node from cache
                        SubNode accntNode = apCache.acctNodesById.get(accntId);

                        // if not in cache find the node and ADD to the cache.
                        if (no(accntNode)) {
                            accntNode = read.getNode(ms, accntId);
                            apCache.acctNodesById.put(accntId, accntNode);
                        }

                        // get username off this node and add to 'toUserNames'
                        if (ok(accntNode)) {
                            String userName = accntNode.getStr(NodeProp.USER.s());
                            toUserNames.add(userName);
                        }
                    }
                }

                // String apId = parent.getStringProp(NodeProp.ACT_PUB_ID.s());
                String fromUser = ThreadLocals.getSC().getUserName();
                String fromActor = apUtil.makeActorUrlForUserName(fromUser);
                String privateKey = apCrypto.getPrivateKey(ms, fromUser);

                APObj message = null;

                // if this node has a boostTarget, we know it's an Announce so we send out the announce
                if (!StringUtils.isEmpty(boostTarget)) {
                    ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);
                    message = apFactory.newAnnounce(fromUser, fromActor, objUrl, toUserNames, boostTarget, now, privateMessage);
                    log.debug("Outbound Announce: " + message);
                }
                // else send out as a note.
                else {
                    message = apFactory.newCreateForNote(fromUser, toUserNames, fromActor, inReplyTo, replyToType, content,
                            objUrl, privateMessage, attachments);
                }

                // for users that don't have a sharedInbox we collect their inboxes here to send to them
                // individually
                HashSet<String> userInboxes = new HashSet<>();

                // When posting a public message we send out to all unique sharedInboxes here
                if (!privateMessage) {
                    HashSet<String> sharedInboxes = new HashSet<>();
                    getSharedInboxesOfFollowers(fromUser, sharedInboxes, userInboxes);

                    if (sharedInboxes.size() > 0 || userInboxes.size() > 0) {
                        for (String inbox : sharedInboxes) {
                            apLog.trace("Posting to Shared Inbox: " + inbox);
                            try {
                                apUtil.securePostEx(inbox, privateKey, fromActor, message, APConst.MTYPE_LD_JSON_PROF);
                            }
                            // catch error from any server, and ignore, go to next server to send to.
                            catch (Exception e) {
                                apLog.trace("failed to post to: " + inbox);
                            }
                        }

                        for (String inbox : userInboxes) {
                            apLog.trace("Posting to User Inbox: " + inbox);
                            try {
                                apUtil.securePostEx(inbox, privateKey, fromActor, message, APConst.MTYPE_LD_JSON_PROF);
                            }
                            // catch error from any server, and ignore, go to next server to send to.
                            catch (Exception e) {
                                apLog.trace("failed to post to: " + inbox);
                            }
                        }
                    }
                }

                // Post message to all foreign usernames found in 'toUserNames'
                if (toUserNames.size() > 0) {
                    sendMessageToUsers(ms, toUserNames, fromUser, message, privateMessage, userInboxes);
                }
            } //
            catch (Exception e) {
                log.error("sendNote failed", e);
                throw new RuntimeException(e);
            }
        });
    }

    // todo-1: this logic can be shared in a generic function if we can separate out 'message' payload
    // from this, and just pass in as argument.
    public void sendActPubForNodeDelete(MongoSession ms, String actPubId, HashMap<String, AccessControl> acl) {
        // if no sharing bail out.
        if (no(acl) || acl.isEmpty())
            return;

        exec.run(() -> {
            try {
                HashSet<String> toUserNames = new HashSet<>();
                boolean privateMessage = true;

                /*
                 * Lookup all userNames from the ACL info, to add them all to 'toUserNames'
                 */
                for (String accntId : acl.keySet()) {
                    if (PrincipalName.PUBLIC.s().equals(accntId)) {
                        privateMessage = false;
                    } else {
                        // try to get account node from cache
                        SubNode accntNode = apCache.acctNodesById.get(accntId);

                        // if not in cache find the node and ADD to the cache.
                        if (no(accntNode)) {
                            accntNode = read.getNode(ms, accntId);
                            apCache.acctNodesById.put(accntId, accntNode);
                        }

                        // get username off this node and add to 'toUserNames'
                        if (ok(accntNode)) {
                            String userName = accntNode.getStr(NodeProp.USER.s());
                            toUserNames.add(userName);
                        }
                    }
                }

                // String apId = parent.getStringProp(NodeProp.ACT_PUB_ID.s());
                String fromUser = ThreadLocals.getSC().getUserName();
                String fromActor = apUtil.makeActorUrlForUserName(fromUser);
                String privateKey = apCrypto.getPrivateKey(ms, fromUser);
                APObj message = apFactory.newDeleteForNote(actPubId, fromActor);

                // for users that don't have a sharedInbox we collect their inboxes here to send to them
                // individually
                HashSet<String> userInboxes = new HashSet<>();

                // When posting a public message we send out to all unique sharedInboxes here
                if (!privateMessage) {
                    HashSet<String> sharedInboxes = new HashSet<>();
                    getSharedInboxesOfFollowers(fromUser, sharedInboxes, userInboxes);

                    if (sharedInboxes.size() > 0 || userInboxes.size() > 0) {

                        for (String inbox : sharedInboxes) {
                            apLog.trace("send Delete to Shared Inbox: " + inbox);
                            try {
                                apUtil.securePostEx(inbox, privateKey, fromActor, message, APConst.MTYPE_LD_JSON_PROF);
                            }
                            // catch error from any server, and ignore, go to next server to send to.
                            catch (Exception e) {
                                apLog.trace("failed to post to: " + inbox);
                            }
                        }

                        for (String inbox : userInboxes) {
                            apLog.trace("send Delete to User Inbox: " + inbox);
                            try {
                                apUtil.securePostEx(inbox, privateKey, fromActor, message, APConst.MTYPE_LD_JSON_PROF);
                            }
                            // catch error from any server, and ignore, go to next server to send to.
                            catch (Exception e) {
                                apLog.trace("failed to delete to: " + inbox);
                            }
                        }
                    }
                }

                // Post message to all foreign usernames found in 'toUserNames'
                if (toUserNames.size() > 0) {
                    sendMessageToUsers(ms, toUserNames, fromUser, message, privateMessage, userInboxes);
                }
            } //
            catch (Exception e) {
                log.error("sendDelete failed", e);
                throw new RuntimeException(e);
            }
        });
    }

    /*
     * Finds all the foreign server followers of userName, and returns the unique set of sharedInboxes
     * of them all.
     */
    public void getSharedInboxesOfFollowers(String userName, HashSet<String> sharedInboxes, HashSet<String> userInboxes) {
        MongoSession as = auth.getAdminSession();

        // This query gets the FRIEND nodes that specifify userName on them
        Query q = apFollower.getFriendsByUserName_query(as, userName);
        if (no(q))
            return;

        Iterable<SubNode> iterable = mongoUtil.find(q);

        for (SubNode node : iterable) {
            // log.debug("follower: " + XString.prettyPrint(node));
            /*
             * Note: The OWNER of this FRIEND node is the person doing the follow, so we look up their account
             * node which is in node.ownerId
             */
            SubNode followerAccount = read.getNode(as, node.getOwner());
            if (ok(followerAccount)) {
                String followerUserName = followerAccount.getStr(NodeProp.USER);
                if (followerUserName.contains("@")) {
                    String sharedInbox = followerAccount.getStr(NodeProp.ACT_PUB_SHARED_INBOX);
                    if (ok(sharedInbox)) {
                        // log.debug("SharedInbox: " + sharedInbox);
                        sharedInboxes.add(sharedInbox);
                    }
                    // not all users have a shared inbox, and the ones that don't we collect here...
                    else {
                        String inbox = followerAccount.getStr(NodeProp.ACT_PUB_ACTOR_INBOX);
                        if (ok(inbox)) {
                            userInboxes.add(inbox);

                            // update cache just because we can
                            apCache.inboxesByUserName.put(followerAccount.getStr(NodeProp.USER.s()), inbox);
                        }
                    }
                }
            }
        }
    }

    public APList createAttachmentsList(SubNode node) {
        APList attachments = null;
        String bin = node.getStr(NodeProp.BIN);
        String mime = node.getStr(NodeProp.BIN_MIME);

        if (ok(bin) && ok(mime)) {
            attachments = new APList().val(//
                    new APObj() //
                            .put(APObj.type, APType.Document) //
                            .put(APObj.mediaType, mime) //
                            // NOTE: The /f/id endpoint is intentionally wide open, but only for nodes that have at least some
                            // sharing
                            // meaning they can be visible to at least someone other than it's owner.
                            .put(APObj.url, prop.getProtocolHostAndPort() + "/f/id/" + node.getIdStr()));
        }
        return attachments;
    }

    /*
     * Sends message outbound to other inboxes, for all inboxes corresponding to all 'toUserNames'
     * IMPORTANT: This method doesn't require or expect 'toUserNames' to have been 'imported' into
     * Quanta. That is, there may not even BE a "user node" for any of these users, or there may be. We
     * don't know or care in here, because we go straight to the WebFinger and build up their outbox
     * "live" from the WebFinger in realtime.
     * 
     * skipInboxes is a way to know which inboxes we've already sent to, and to not send again
     */
    public void sendMessageToUsers(MongoSession ms, HashSet<String> toUserNames, String fromUser, APObj message,
            boolean privateMessage, HashSet<String> skipInboxes) {
        if (no(toUserNames))
            return;

        String host = prop.getMetaHost();
        String fromActor = null;

        /*
         * Post the same message to all the inboxes that need to see it
         */
        for (String toUserName : toUserNames) {
            // Ignore userNames that are not foreign server names
            if (!toUserName.contains("@")) {
                continue;
            }

            String inbox = apCache.inboxesByUserName.get(toUserName);

            // if inbox wasn't found in cache we start trying to get it, trying DB first.
            if (no(inbox)) {
                // First try to get inbox for toUserName by looking for it the DB (with allowImport=false, to NOT
                // import)
                inbox = (String) arun.run(as -> {
                    String ibox = null;
                    SubNode toUserAccntNode = apub.getAcctNodeByForeignUserName(as, fromUser, toUserName, true, false);
                    if (ok(toUserAccntNode)) {
                        ibox = toUserAccntNode.getStr(NodeProp.ACT_PUB_ACTOR_INBOX);
                        if (ok(ibox)) {
                            log.debug("FOUND INBOX IN DB: " + ibox);
                        }
                    }
                    return ibox;
                });
            } else {
                log.debug("cache hit on inbox: " + inbox);
            }

            /*
             * if this inbox is null here, it just means we haven't imported the user into Quanta and that is
             * fine, and we don't want to import them now either when all that's happening is they're being sent
             * a message, so in this case access the user from scratch by getting webFinger, actorObject, etc.
             */
            if (no(inbox)) {
                // Ignore userNames that are for our own host
                String userHost = apUtil.getHostFromUserName(toUserName);
                if (userHost.equals(host)) {
                    continue;
                }

                // log.debug("to Foreign User: " + toUserName);
                APObj webFinger = apUtil.getWebFinger(ms, fromUser, toUserName);
                if (no(webFinger)) {
                    apLog.trace("Unable to get webfinger for " + toUserName);
                    continue;
                }

                String toActorUrl = apUtil.getActorUrlFromWebFingerObj(webFinger);
                APObj toActorObj = apUtil.getActorByUrl(ms, fromUser, toActorUrl);
                if (ok(toActorObj)) {
                    // log.debug(" actor: " + toActorUrl);
                    inbox = apStr(toActorObj, APObj.inbox);
                }
            }

            if (!StringUtils.isEmpty(inbox)) {
                /*
                 * regardless of how we ended up getting 'inbox' here we cache it by userName, so that future calls
                 * to this method to send them more messages will be lightning fast (from memory)
                 */
                apCache.inboxesByUserName.put(toUserName, inbox);

                // send post if inbox not in skipInboxes
                if (!skipInboxes.contains(inbox)) {
                    /* lazy create fromActor here */
                    if (no(fromActor)) {
                        fromActor = apUtil.makeActorUrlForUserName(fromUser);
                    }

                    String userDoingPost = ThreadLocals.getSC().getUserName();
                    // log.debug("Posting object:\n" + XString.prettyPrint(message) + "\n to inbox: " + inbox);
                    String privateKey = apCrypto.getPrivateKey(ms, userDoingPost);
                    apUtil.securePostEx(inbox, privateKey, fromActor, message, APConst.MTYPE_LD_JSON_PROF);
                }
            }
        }
    }

    /**
     * Gets the account SubNode representing foreign user apUserName (like someuser@fosstodon.org), by
     * first checking the 'acctNodesByUserName' cache, or else by reading in the user from, the database
     * (if preferDbNode==true) or else the we read from the Fediverse, and updating the cache.
     */
    public SubNode getAcctNodeByForeignUserName(MongoSession ms, String userDoingAction, String apUserName, boolean preferDbNode,
            boolean allowImport) {
        apUserName = XString.stripIfStartsWith(apUserName, "@");
        if (!apUserName.contains("@")) {
            log.debug("Invalid foreign user name: " + apUserName);
            return null;
        }
        saveFediverseName(apUserName);

        // return from cache if we already have the value cached
        SubNode acctNode = apCache.acctNodesByUserName.get(apUserName);
        if (ok(acctNode)) {
            return acctNode;
        }

        if (preferDbNode) {
            acctNode = read.getUserNodeByUserName(ms, apUserName);
        }

        if (no(acctNode) && allowImport) {
            /* First try to get a cached actor APObj */
            APObj actor = apCache.actorsByUserName.get(apUserName);

            // if we have actor object skip the step of getting it and import using it.
            if (ok(actor)) {
                acctNode = importActor(ms, null, actor);
            }
        }

        /*
         * if we were unable to get the acctNode, then we need to read it from scratch meaning starting at
         * the very beginning which is to get webFinger first and load from there
         */
        if (no(acctNode) && allowImport) {
            log.debug("Load:" + apUserName);
            APObj webFinger = apUtil.getWebFinger(ms, userDoingAction, apUserName);

            if (ok(webFinger)) {
                String actorUrl = apUtil.getActorUrlFromWebFingerObj(webFinger);
                if (ok(actorUrl)) {
                    acctNode = getAcctNodeByActorUrl(ms, userDoingAction, actorUrl);
                }
            }
        }

        // if we got the SubNode, cache it before returning it.
        if (ok(acctNode)) {
            // Any time we have an account node being cached we should cache it by it's ID too right away.
            apCache.acctNodesById.put(acctNode.getIdStr(), acctNode);
            apCache.acctNodesByUserName.put(apUserName, acctNode);
        } else {
            // it's only an error if we were allowing an import, otherwise a null return is *not* an error, but
            // a normal flow.
            if (allowImport) {
                log.error("Unable to load user: " + apUserName);
            }
        }
        return acctNode;
    }

    /**
     * Gets foreign account SubNode using actorUrl, using the cached copy of found.
     */
    @PerfMon(category = "apub")
    public SubNode getAcctNodeByActorUrl(MongoSession ms, String userDoingAction, String actorUrl) {
        saveFediverseName(actorUrl);

        /* return node from cache if already cached */
        SubNode acctNode = apCache.acctNodesByActorUrl.get(actorUrl);
        if (ok(acctNode)) {
            return acctNode;
        }

        APObj actor = apUtil.getActorByUrl(ms, userDoingAction, actorUrl);

        // if webfinger was successful, ensure the user is imported into our system.
        if (ok(actor)) {
            acctNode = importActor(ms, null, actor);
            if (ok(acctNode)) {
                // Any time we have an account node being cached we should cache it by it's ID too right away.
                apCache.acctNodesById.put(acctNode.getIdStr(), acctNode);
                apCache.acctNodesByActorUrl.put(actorUrl, acctNode);
            }
        }
        return acctNode;
    }

    /*
     * Returns account node of the user, creating one if not already existing. If the userNode already
     * exists and the caller happens to have it we can pass in as non-null userNode and it will get
     * used.
     */
    @PerfMon(category = "apub")
    public SubNode importActor(MongoSession ms, SubNode userNode, Object actor) {

        // if userNode unknown then get and/or create one. May be creating a brand new one even.
        if (no(userNode)) {
            String apUserName = apUtil.getLongUserNameFromActor(actor).trim();

            // This checks for both the non-port and has-port versions of the host (host may or may not have
            // port)
            if (apUserName.endsWith("@" + prop.getMetaHost().toLowerCase())
                    || apUserName.contains("@" + prop.getMetaHost().toLowerCase() + ":")) {
                log.debug("Can't import a user that's not from a foreign server.");
                return null;
            }
            apLog.trace("importing Actor: " + apUserName);

            saveFediverseName(apUserName);

            // Try to get the userNode for this actor
            userNode = read.getUserNodeByUserName(ms, apUserName);

            /*
             * If we don't have this user in our system, create them.
             */
            if (no(userNode)) {
                userNode = mongoUtil.createUser(ms, apUserName, null, null, true);
            }
        }

        boolean changed = false;
        Object icon = apObj(actor, APObj.icon);
        if (ok(icon)) {
            String iconUrl = apStr(icon, APObj.url);
            if (ok(iconUrl)) {
                String curIconUrl = userNode.getStr(NodeProp.ACT_PUB_USER_ICON_URL.s());
                if (!iconUrl.equals(curIconUrl)) {
                    if (userNode.set(NodeProp.ACT_PUB_USER_ICON_URL.s(), iconUrl)) {
                        changed = true;
                    }
                }
            }
        }

        Object endpoints = apObj(actor, APObj.endpoints);
        if (ok(endpoints)) {
            String sharedInbox = apStr(endpoints, APObj.sharedInbox);
            if (ok(sharedInbox)) {
                String curSharedInbox = userNode.getStr(NodeProp.ACT_PUB_SHARED_INBOX.s());
                if (!sharedInbox.equals(curSharedInbox)) {
                    if (userNode.set(NodeProp.ACT_PUB_SHARED_INBOX.s(), sharedInbox)) {
                        changed = true;
                    }
                }
            }
        }

        Object image = apObj(actor, APObj.image);
        if (ok(image)) {
            String imageUrl = apStr(image, APObj.url);
            if (ok(imageUrl)) {
                String curImageUrl = userNode.getStr(NodeProp.ACT_PUB_USER_IMAGE_URL.s());
                if (!imageUrl.equals(curImageUrl)) {
                    if (userNode.set(NodeProp.ACT_PUB_USER_IMAGE_URL.s(), imageUrl)) {
                        changed = true;
                    }
                }
            }
        }

        if (userNode.set(NodeProp.USER_BIO.s(), apStr(actor, APObj.summary)))
            changed = true;

        if (userNode.set(NodeProp.DISPLAY_NAME.s(), apStr(actor, APObj.name)))
            changed = true;

        // this is the URL of the Actor JSON object
        if (userNode.set(NodeProp.ACT_PUB_ACTOR_ID.s(), apStr(actor, APObj.id)))
            changed = true;

        String inbox = apStr(actor, APObj.inbox);

        // update cache just because we can
        apCache.inboxesByUserName.put(userNode.getStr(NodeProp.USER.s()), inbox);

        if (userNode.set(NodeProp.ACT_PUB_ACTOR_INBOX.s(), inbox))
            changed = true;

        // this is the URL of the HTML of the actor.
        if (userNode.set(NodeProp.ACT_PUB_ACTOR_URL.s(), apStr(actor, APObj.url)))
            changed = true;

        // get the pubKey so we can save into our account node
        String pubKey = apCrypto.getEncodedPubKeyFromActorObj(actor);

        // this is the PublicKey.pubKeyPem, of the user
        if (userNode.set(NodeProp.ACT_PUB_KEYPEM.s(), pubKey))
            changed = true;

        if (changed) {
            update.save(ms, userNode, false);
        }

        /* cache the account node id for this user by the actor url */
        String selfRef = apStr(actor, APObj.id); // actor url of 'actor' object, is the same as the 'id'
        apCache.acctIdByActorUrl.put(selfRef, userNode.getIdStr());
        return userNode;
    }

    /*
     * Processes incoming INBOX requests for (Follow, Undo Follow), to be called by foreign servers to
     * follow a user on this server
     */
    @PerfMon(category = "apub")
    public void processInboxPost(HttpServletRequest httpReq, Object payload) {
        String type = apStr(payload, APObj.type);
        if (no(type))
            return;
        type = type.trim();
        apLog.trace("inbox type: " + type);

        switch (type) {
            case APType.Create:
            case APType.Update:
                /*
                 * todo-1: I'm waiting for a way to test what the inbound call looks like for an Update, before
                 * coding the outbound call but don't know of any live instances that support it yet.
                 */
                processCreateOrUpdateAction(httpReq, payload, type);
                break;

            case APType.Follow:
                apFollowing.processFollowAction(payload, false);
                break;

            case APType.Undo:
                processUndoAction(httpReq, payload);
                break;

            case APType.Delete:
                processDeleteAction(httpReq, payload);
                break;

            case APType.Accept:
                processAcceptAction(payload);
                break;

            case APType.Like:
                processLikeAction(httpReq, payload, false);
                break;

            case APType.Announce:
                processAnnounceAction(httpReq, payload, false);
                break;

            default:
                log.debug("Unsupported type:" + XString.prettyPrint(payload));
                break;
        }
    }

    /* Process inbound undo actions (coming from foreign servers) */
    @PerfMon(category = "apub")
    public void processUndoAction(HttpServletRequest httpReq, Object payload) {
        Object obj = apObj(payload, APObj.object);
        String type = apStr(obj, APObj.type);
        apLog.trace("Undo Type: " + type);
        switch (type) {
            case APType.Follow:
                apFollowing.processFollowAction(obj, true);
                break;

            case APType.Like:
                processLikeAction(httpReq, payload, true);
                break;

            case APType.Announce:
                processAnnounceAction(httpReq, payload, true);
                break;

            default:
                log.debug("Unsupported Undo payload object type:" + XString.prettyPrint(obj));
                break;
        }
    }

    @PerfMon(category = "apub")
    public void processAcceptAction(Object payload) {
        Object obj = apObj(payload, APObj.object);
        String type = apStr(obj, APObj.type);
        apLog.trace("Accept Type: " + type);
        switch (type) {
            case APType.Follow:
                apLog.trace("Nothing to do for Follow Acceptance. no op.");
                break;

            default:
                log.debug("Unsupported payload object type:" + XString.prettyPrint(obj));
                break;
        }
    }

    /* action will be APType.Create or APType.Update */
    @PerfMon(category = "apub")
    public void processCreateOrUpdateAction(HttpServletRequest httpReq, Object payload, String action) {
        arun.<Object>run(ms -> {
            apLog.trace("processCreateOrUpdateAction");

            // get actor url from payload object
            String actorUrl = apStr(payload, APObj.actor);
            if (no(actorUrl)) {
                log.debug("no 'actor' found on create action request posted object");
                return null;
            }

            PublicKey pubKey = apCrypto.getPubKeyFromActorUrl(null, actorUrl);

            try {
                apCrypto.verifySignature(httpReq, pubKey);
            } catch (Exception e) {
                log.error("Sig failed.");
                return null;
            }

            Object object = apObj(payload, APObj.object);
            String type = apStr(object, APObj.type);
            apLog.trace("create type: " + type);

            switch (type) {
                case APType.ChatMessage:
                case APType.Note:
                    processCreateOrUpdateNote(ms, actorUrl, object, action);
                    break;

                default:
                    // this captures videos? and other things (todo-1: add more support)
                    log.debug("Unhandled Create action: " + type + "\n" + XString.prettyPrint(payload));
                    break;
            }
            return null;
        });
    }

    @PerfMon(category = "apub")
    public void processLikeAction(HttpServletRequest httpReq, Object payload, boolean unlike) {
        arun.<Object>run(as -> {
            apLog.trace("process " + (unlike ? "unlike" : "like"));
            String actorUrl = apStr(payload, APObj.actor);
            if (no(actorUrl)) {
                log.debug("no 'actor' found on create action request posted object");
                return null;
            }

            PublicKey pubKey = apCrypto.getPubKeyFromActorUrl(null, actorUrl);

            try {
                apCrypto.verifySignature(httpReq, pubKey);
            } catch (Exception e) {
                log.error("Sig failed.");
                return null;
            }

            String objectIdUrl = apStr(payload, APObj.object);

            if (no(objectIdUrl)) {
                log.debug("Unable to get object from payload: " + XString.prettyPrint(payload));
                return null;
            }

            // For now we don't maintain likes on nodes that aren't native to Quanta.
            if (!objectIdUrl.startsWith(prop.getProtocolHostAndPort())) {
                log.debug("Ignoring 'like' on foreign node: " + objectIdUrl);
                return null;
            }

            // Our objects are identified like this: "https://quanta.wiki?id=6277120c1363dc5d1fb426b5"
            // So by chopping after last '=' we can get the ID part.
            String nodeId = XString.parseAfterLast(objectIdUrl, "=");
            SubNode node = read.getNode(as, nodeId);
            if (no(node)) {
                throw new RuntimeException("Unable to find node: " + nodeId);
            }
            if (no(node.getLikes())) {
                node.setLikes(new HashSet<>());
            }

            if (!unlike) {
                if (node.getLikes().add(actorUrl)) {
                    // set node to dirty only if it just changed.
                    ThreadLocals.dirty(node);
                }
            } else {
                if (node.getLikes().remove(actorUrl)) {
                    // set node to dirty only if it just changed.
                    ThreadLocals.dirty(node);

                    // if likes set is now empty make it null.
                    if (node.getLikes().size() == 0) {
                        node.setLikes(null);
                    }
                }
            }

            return null;
        });
    }

    @PerfMon(category = "apub")
    public void processAnnounceAction(HttpServletRequest httpReq, Object payload, boolean undo) {
        arun.<Object>run(as -> {
            apLog.trace("process " + (undo ? "unannounce" : "announe") + " Payload=" + XString.prettyPrint(payload));

            // get actorUrl
            String actorUrl = apStr(payload, APObj.actor);
            if (no(actorUrl)) {
                log.debug("no 'actor' found on create action request posted object");
                return null;
            }

            PublicKey pubKey = apCrypto.getPubKeyFromActorUrl(null, actorUrl);

            try {
                apCrypto.verifySignature(httpReq, pubKey);
            } catch (Exception e) {
                log.error("Sig failed.");
                return null;
            }

            // if this is an undo operation we just delete the node and we're done.
            if (undo) {
                String id = apStr(payload, APObj.id);
                delete.deleteByPropVal(as, NodeProp.ACT_PUB_ID.s(), id);
                return null;
            }

            // get the url of the thing being boosted
            String objectIdUrl = apStr(payload, APObj.object);
            if (no(objectIdUrl)) {
                log.debug("Unable to get object from payload: " + XString.prettyPrint(payload));
                return null;
            }

            // find or create an actual node that will hold the target thing being boosted
            SubNode boostedNode = apUtil.loadObject(as, null, objectIdUrl);
            if (ok(boostedNode)) {
                // log.debug("BOOSTING: " + XString.prettyPrint(boostedNode));

                // get account node for person doing the boosting
                SubNode actorAccountNode = getAcctNodeByActorUrl(as, null, actorUrl);
                if (ok(actorAccountNode)) {
                    String userName = actorAccountNode.getStr(NodeProp.USER.s());

                    // get posts node which will be parent we save boost into
                    SubNode postsNode = read.getUserNodeByType(as, userName, actorAccountNode, "### Posts",
                            NodeType.ACT_PUB_POSTS.s(), Arrays.asList(PrivilegeType.READ.s()), NodeName.POSTS);

                    saveObj(as, null, actorAccountNode, postsNode, payload, false, false, APType.Announce,
                            boostedNode.getIdStr());
                }
            } else {
                log.debug("Unable to get node being boosted.");
            }

            return null;
        });
    }

    @PerfMon(category = "apub")
    public void processDeleteAction(HttpServletRequest httpReq, Object payload) {
        arun.<Object>run(as -> {
            apLog.trace("processDeleteAction");
            String actorUrl = apStr(payload, APObj.actor);
            if (no(actorUrl)) {
                log.debug("no 'actor' found on create action request posted object");
                return null;
            }

            PublicKey pubKey = apCrypto.getPubKeyFromActorUrl(null, actorUrl);

            try {
                apCrypto.verifySignature(httpReq, pubKey);
            } catch (Exception e) {
                log.error("Sig failed.");
                return null;
            }

            Object object = apObj(payload, APObj.object);
            String type = apStr(object, APObj.type);
            if (no(type)) {
                log.error("No delete type specified in delete request: " + XString.prettyPrint(payload));
                return null;
            }
            log.debug("delete: " + type);

            String id = apStr(object, APObj.id);
            delete.deleteByPropVal(as, NodeProp.ACT_PUB_ID.s(), id);
            return null;
        });
    }

    /*
     * obj is the 'Note' object.
     * 
     * action will be APType.Create or APType.Update
     */
    @PerfMon(category = "apub")
    public void processCreateOrUpdateNote(MongoSession ms, String actorUrl, Object obj, String action) {
        apLog.trace("processCreateOrUpdateNote");
        /*
         * If this is a 'reply' post then parse the ID out of this, and if we can find that node by that id
         * then insert the reply under that, instead of the default without this id which is to put in
         * 'inbox'
         */
        String inReplyTo = apStr(obj, APObj.inReplyTo);

        /* This will say null unless inReplyTo is used to get an id to lookup */
        SubNode nodeBeingRepliedTo = null;

        /*
         * Detect if inReplyTo is formatted like this: 'https://domain.com?id=xxxxx' (proprietary URL format
         * for this server) and if so lookup the nodeBeingRepliedTo by using that nodeId
         */
        if (apUtil.isLocalUrl(inReplyTo)) {
            int lastIdx = inReplyTo.lastIndexOf("=");
            String replyToId = null;
            if (lastIdx != -1) {
                replyToId = inReplyTo.substring(lastIdx + 1);
                nodeBeingRepliedTo = read.getNode(ms, replyToId, false);
            }
        }

        /*
         * If a foreign user is replying to a specific node, we put the reply under that node
         */
        if (ok(nodeBeingRepliedTo)) {
            apLog.trace("foreign actor replying to a quanta node.");
            saveObj(ms, null, null, nodeBeingRepliedTo, obj, false, false, action, null);
        }
        /*
         * Otherwise the node is not a reply so we put it under POSTS node inside the foreign account node
         * on our server, and then we add 'sharing' to it for each person in the 'to/cc' so that this new
         * node will show up in those people's FEEDs
         */
        else {
            apLog.trace("not reply to existing Quanta node.");

            // get actor's account node from their actorUrl
            SubNode actorAccountNode = getAcctNodeByActorUrl(ms, null, actorUrl);
            if (ok(actorAccountNode)) {
                String userName = actorAccountNode.getStr(NodeProp.USER.s());
                SubNode postsNode = read.getUserNodeByType(ms, userName, actorAccountNode, "### Posts",
                        NodeType.ACT_PUB_POSTS.s(), Arrays.asList(PrivilegeType.READ.s()), NodeName.POSTS);
                saveObj(ms, null, actorAccountNode, postsNode, obj, false, false, action, null);
            }
        }
    }

    /*
     * Saves inbound note (or CharMessage) comming from other foreign servers
     * 
     * todo-1: when importing users in bulk (like at startup or the admin menu), some of these queries
     * in here will be redundant. Look for ways to optimize.
     * 
     * temp = true, means we are loading an outbox of a user and not recieving a message specifically to
     * a local user so the node should be considered 'temporary' and can be deleted after a week or so
     * to clean the Db.
     * 
     * This saves correctly either a obj.type==Note or obj.type==ChatMessage (maybe more to come?)
     * 
     * action will be APType.Create, APType.Update, or APType.Announce
     */
    @PerfMon(category = "apub")
    public SubNode saveObj(MongoSession ms, String userDoingAction, SubNode toAccountNode, SubNode parentNode, Object obj,
            boolean forcePublic, boolean temp, String action, String boostTargetId) {
        apLog.trace("saveObject [" + action + "]" + XString.prettyPrint(obj));
        String id = apStr(obj, APObj.id);

        /*
         * First look to see if there is a target node already existing for this so we don't add a duplicate
         * 
         * note: partial index "unique-apid", is what makes this lookup fast.
         */
        SubNode dupNode = read.findNodeByProp(ms, parentNode, NodeProp.ACT_PUB_ID.s(), id);

        // If we found this node by ID and we aren't going to be updating it, return it as is.
        if (ok(dupNode) && !action.equals(APType.Update)) {
            // apLog.trace("duplicate ActivityPub post ignored: " + id);
            return dupNode;
        }

        Date published = apDate(obj, APObj.published);
        String inReplyTo = apStr(obj, APObj.inReplyTo);
        String contentHtml = APType.Announce.equals(action) ? "" : apStr(obj, APObj.content);
        String objUrl = apStr(obj, APObj.url);
        String objAttributedTo = apStr(obj, APObj.attributedTo);
        String objType = apStr(obj, APObj.type);
        Boolean sensitive = apBool(obj, APObj.sensitive);
        Object tagArray = apList(obj, APObj.tag);

        // Ignore non-english for now (later we can make this a user-defined language selection)
        String lang = "0";
        Object context = apObj(obj, APObj.context);
        if (ok(context)) {
            String language = apStr(context, "@language");
            if (ok(language)) {
                lang = language;
                if (!"en".equalsIgnoreCase(language)) {
                    log.debug("Ignoring Non-English");
                    return null;
                }
            }
        }

        if (ENGLISH_LANGUAGE_CHECK) {
            if (lang.equals("0")) {
                if (!english.isEnglish(contentHtml)) {
                    log.debug("Ignored Foreign: " + XString.prettyPrint(obj));
                    return null;
                } else {
                    // this was an arbitrary meaningless value used to detect/test for correct program flow.
                    lang = "en-ck3";
                }
            }
        }

        // foreign account will own this node, this may be passed if it's known or null can be passed in.
        if (no(toAccountNode)) {
            toAccountNode = getAcctNodeByActorUrl(ms, userDoingAction, objAttributedTo);
        }
        SubNode newNode =
                create.createNode(ms, parentNode, null, null, 0L, CreateNodeLocation.LAST, null, toAccountNode.getId(), true);

        // If we're updating a node, find what the ID should be and we can just put that ID value into
        // newNode
        if (action.equals(APType.Update)) {
            // if we didn't find what to update throw error.
            if (no(dupNode)) {
                throw new RuntimeException("Unable to find node to update.");
            }

            // If wrong user is updating this object throw error.
            String dupNodeAttributedTo = dupNode.getStr(NodeProp.ACT_PUB_OBJ_ATTRIBUTED_TO);
            if (no(dupNodeAttributedTo) || !dupNodeAttributedTo.equals(objAttributedTo)) {
                throw new RuntimeException("Wrong person to update object.");
            }

            // remove dupNode from memory cache so it can't be written out
            ThreadLocals.clean(dupNode);

            newNode.setId(dupNode.getId());
            ThreadLocals.clean(newNode);
        }

        // todo-1: need a new node prop type that is just 'html' and tells us to render
        // content as raw html if set, or for now
        // we could be clever and just detect if it DOES have tags and does NOT have
        // '```'
        newNode.setContent(contentHtml);

        // If we have a tagArray object save it on the node properties.
        if (tagArray != null) {
            newNode.set(NodeProp.ACT_PUB_TAG.s(), tagArray);
        }

        /*
         * todo-1: I haven't yet tested that mentions are parsable in any Mastodon text using this method
         * but we at least know other instances of Quanta will have these extractable this way.
         */
        HashSet<String> mentionsSet = auth.parseMentionsFromString(null, contentHtml);
        importUsers(ms, mentionsSet);
        if (ok(mentionsSet)) {
            for (String mentionName : mentionsSet) {
                saveFediverseName(mentionName);
            }
        }
        newNode.setModifyTime(published);

        if (ok(sensitive) && sensitive.booleanValue()) {
            newNode.set(NodeProp.ACT_PUB_SENSITIVE.s(), "y");
        }

        if (temp) {
            newNode.set(NodeProp.TEMP.s(), "1");
        }

        newNode.set(NodeProp.ACT_PUB_ID.s(), id);
        newNode.set(NodeProp.ACT_PUB_OBJ_URL.s(), objUrl);
        newNode.set(NodeProp.ACT_PUB_OBJ_INREPLYTO.s(), inReplyTo);
        newNode.set(NodeProp.ACT_PUB_OBJ_TYPE.s(), objType);
        newNode.set(NodeProp.ACT_PUB_OBJ_ATTRIBUTED_TO.s(), objAttributedTo);

        if (ok(boostTargetId)) {
            newNode.set(NodeProp.BOOST.s(), boostTargetId);
        }

        // part of troubleshooting the non-english language detection
        // newNode.setProp("lang", lang);

        shareToAllObjectRecipients(ms, userDoingAction, newNode, obj, APObj.to);
        shareToAllObjectRecipients(ms, userDoingAction, newNode, obj, APObj.cc);

        if (forcePublic) {
            acl.addPrivilege(ms, null, newNode, PrincipalName.PUBLIC.s(),
                    Arrays.asList(PrivilegeType.READ.s(), PrivilegeType.WRITE.s()), null);
        }

        update.save(ms, newNode);
        addAttachmentIfExists(ms, newNode, obj);

        try {
            push.pushNodeUpdateToBrowsers(ms, null, newNode);
        } catch (Exception e) {
            log.error("pushNodeUpdateToBrowsers failed (ignoring error)", e);
        }
        return newNode;
    }

    // imports the list of foreign users into the system
    public void importUsers(MongoSession ms, HashSet<String> users) {
        if (no(users))
            return;

        users.forEach(user -> {
            // clean user if it's in '@mention' format
            user = XString.stripIfStartsWith(user, "@");

            // make sure username contains @ making it a foreign user.
            if (user.contains("@")) {
                SubNode userNode = getAcctNodeByForeignUserName(ms, null, user, true, true);
                if (!ok(userNode)) {
                    log.debug("Unable to import user: " + user);
                }
            }
        });
    }

    /*
     * Adds node sharing (ACL) entries for all recipients (i.e. propName==to | cc)
     * 
     * The node save is expected to be done external to this function after this function runs.
     */
    @PerfMon(category = "apub")
    private void shareToAllObjectRecipients(MongoSession ms, String userDoingAction, SubNode node, Object obj, String propName) {
        List<?> list = apList(obj, propName);
        if (ok(list)) {
            /* Build up all the access controls */
            for (Object to : list) {
                if (to instanceof String) {
                    /* The spec allows either a 'followers' URL here or an 'actor' URL here */
                    shareToUsersForUrl(ms, userDoingAction, node, (String) to);
                } else {
                    apLog.trace("to list entry not supported: " + to.getClass().getName());
                }
            }
        } else {
            apLog.trace("No addressing to " + propName);
        }
    }

    /*
     * Reads the object from 'url' to determine if it's a 'followers' URL or an 'actor' URL, and then
     * shares the node to either all the followers or the specific actor
     */
    private void shareToUsersForUrl(MongoSession ms, String userDoingAction, SubNode node, String url) {
        apLog.trace("shareToUsersForUrl: " + url);

        if (apUtil.isPublicAddressed(url)) {
            acl.makePublicAppendable(ms, node);
            return;
        }

        /*
         * if url does not contain "/followers" then the best first try is to assume it's an actor url and
         * try that first
         */
        if (!url.contains("/followers")) {
            shareNodeToActorByUrl(ms, userDoingAction, node, url);
        }
        /*
         * else assume this is a 'followers' url. Sharing normally will include a 'followers' and run this
         * code path when some foreign user has a mention of our local user and is also a public post, and
         * the foreign mastodon will then encode a 'followers' url into the 'to' or 'cc' of the incomming
         * node designating that it's shared to all the followers (I think even 'private' messages to all
         * followers will have this as well)
         */
        else {
            /*
             * I'm decided to disable this code, but leave it in place for future referece, but for now this
             * platform doesn't support the concept of sharing only to followers. Everything is either shared to
             * public, or shared explicitly to specific users.
             */
            boolean allow = false;
            if (allow) {
                APObj followersObj = apUtil.getJson(ms, userDoingAction, url, APConst.MTYPE_ACT_JSON);
                if (ok(followersObj)) {
                    // note/warning: the ActPubFollower.java class also has code to read followers.
                    apUtil.iterateOrderedCollection(ms, userDoingAction, followersObj, MAX_FOLLOWERS, obj -> {
                        /*
                         * Mastodon seems to have the followers items as strings, which are the actor urls of the followers.
                         */
                        if (obj instanceof String) {
                            String followerActorUrl = (String) obj;
                            shareNodeToActorByUrl(ms, userDoingAction, node, followerActorUrl);
                        }
                        return true;
                    });
                }
            }
        }
    }

    /*
     * Shares this node to the designated user using their actorUrl and is expected to work even if the
     * actorUrl points to a local user
     */
    @PerfMon(category = "apub")
    private void shareNodeToActorByUrl(MongoSession ms, String userDoingAction, SubNode node, String actorUrl) {
        apLog.trace("Sharing node to actorUrl: " + actorUrl);
        /*
         * Yes we tolerate for this to execute with the 'public' designation in place of an actorUrl here
         */
        if (actorUrl.endsWith("#Public")) {
            acl.makePublicAppendable(ms, node);
            return;
        }

        saveFediverseName(actorUrl);

        /* try to get account id from cache first */
        String acctId = apCache.acctIdByActorUrl.get(actorUrl);

        /*
         * if acctId not found in cache load foreign user (will cause it to also get cached)
         */
        if (no(acctId)) {
            SubNode acctNode = null;

            if (apUtil.isLocalActorUrl(actorUrl)) {
                String longUserName = apUtil.getLongUserNameFromActorUrl(ms, userDoingAction, actorUrl);
                acctNode = read.getUserNodeByUserName(ms, longUserName);
            } else {
                /*
                 * todo-1: this is contributing to our [currently] unwanted FEDIVERSE CRAWLER effect chain reaction.
                 * The rule here should be either don't load foreign users whose outboxes you don't plan to load or
                 * else have some property on the node that designates if we need to read the actual outbox or if
                 * you DO want to add a user and not load their outbox.
                 */
                // acctNode = loadForeignUserByActorUrl(ms, actorUrl);
                saveFediverseName(actorUrl);
            }

            if (ok(acctNode)) {
                acctId = acctNode.getIdStr();
            }
        }

        if (ok(acctId)) {
            apLog.trace("node shared to UserNodeId: " + acctId);
            acl.setKeylessPriv(ms, node, acctId, APConst.RDWR);
        } else {
            apLog.trace("not sharing to this user.");
        }
    }

    private void addAttachmentIfExists(MongoSession ms, SubNode node, Object obj) {
        List<?> attachments = apList(obj, APObj.attachment);
        if (no(attachments))
            return;

        for (Object att : attachments) {
            String mediaType = apStr(att, APObj.mediaType);
            String url = apStr(att, APObj.url);

            if (ok(mediaType) && ok(url)) {
                attach.readFromUrl(ms, url, node.getIdStr(), mediaType, -1, false);

                // for now we only support one attachment so break out after uploading one.
                break;
            }
        }
    }

    /*
     * Generates an Actor object for one of our own local users
     */
    @PerfMon(category = "apub")
    public APObj generateActor(String userName) {
        String host = prop.getProtocolHostAndPort();

        try {
            SubNode userNode = read.getUserNodeByUserName(null, userName);
            if (ok(userNode)) {
                user.ensureValidCryptoKeys(userNode);

                String publicKey = userNode.getStr(NodeProp.CRYPTO_KEY_PUBLIC.s());
                String displayName = userNode.getStr(NodeProp.DISPLAY_NAME.s());
                String avatarMime = userNode.getStr(NodeProp.BIN_MIME.s());
                String avatarVer = userNode.getStr(NodeProp.BIN.s());
                String did = userNode.getStr(NodeProp.USER_DID_IPNS.s());
                String avatarUrl = prop.getProtocolHostAndPort() + AppController.API_PATH + "/bin/avatar" + "?nodeId="
                        + userNode.getIdStr() + "&v=" + avatarVer;

                APObj actor = new APObj() //
                        .put(APObj.context, new APList() //
                                .val(APConst.CONTEXT_STREAMS) //
                                .val(APConst.CONTEXT_SECURITY))

                        /*
                         * Note: this is a self-reference, and must be identical to the URL that returns this object
                         */
                        .put(APObj.id, apUtil.makeActorUrlForUserName(userName)) //
                        .put(APObj.type, APType.Person) //
                        .put(APObj.did, did) //
                        .put(APObj.preferredUsername, userName) //
                        .put(APObj.name, displayName) //

                        .put(APObj.icon, new APObj() //
                                .put(APObj.type, APType.Image) //
                                .put(APObj.mediaType, avatarMime) //
                                .put(APObj.url, avatarUrl));

                String headerImageMime = userNode.getStr(NodeProp.BIN_MIME.s() + "Header");
                if (ok(headerImageMime)) {
                    String headerImageVer = userNode.getStr(NodeProp.BIN.s() + "Header");
                    if (ok(headerImageVer)) {
                        String headerImageUrl = prop.getProtocolHostAndPort() + AppController.API_PATH + "/bin/profileHeader"
                                + "?nodeId=" + userNode.getIdStr() + "&v=" + headerImageVer;

                        actor.put(APObj.image, new APObj() //
                                .put(APObj.type, APType.Image) //
                                .put(APObj.mediaType, headerImageMime) //
                                .put(APObj.url, headerImageUrl));
                    }
                }

                actor.put(APObj.summary, userNode.getStr(NodeProp.USER_BIO.s())) //
                        .put(APObj.inbox, host + APConst.PATH_INBOX + "/" + userName) //
                        .put(APObj.outbox, host + APConst.PATH_OUTBOX + "/" + userName) //
                        .put(APObj.followers, host + APConst.PATH_FOLLOWERS + "/" + userName) //
                        .put(APObj.following, host + APConst.PATH_FOLLOWING + "/" + userName) //

                        /*
                         * Note: Mastodon requests the wrong url when it needs this but we compansate with a redirect to
                         * this in our ActPubController. We tolerate Mastodon breaking spec here.
                         */
                        .put(APObj.url, host + "/u/" + userName + "/home") //
                        .put(APObj.endpoints, new APObj().put(APObj.sharedInbox, host + APConst.PATH_INBOX)) //

                        .put(APObj.publicKey, new APObj() //
                                .put(APObj.id, apStr(actor, APObj.id) + "#main-key") //
                                .put(APObj.owner, apStr(actor, APObj.id)) //
                                .put(APObj.publicKeyPem,
                                        "-----BEGIN PUBLIC KEY-----\n" + publicKey + "\n-----END PUBLIC KEY-----\n")) //

                        .put(APObj.supportsFriendRequests, true);

                apLog.trace("Reply with Actor: " + XString.prettyPrint(actor));
                return actor;
            }
        } catch (Exception e) {
            log.error("actor query failed", e);
            throw new RuntimeException(e);
        }
        return null;
    }

    /*
     * Be careful, becasue any user you queue into here will have their outbox loaded into Quanta, and
     * it's easy to set off a chain reaction where more users keep comming in like a FediCrawler
     */
    public void userEncountered(String apUserName, boolean force) {
        saveFediverseName(apUserName);

        if (force) {
            queueUserForRefresh(apUserName, force);
        }
    }

    /*
     * For now name can be an actual username or an actor URL. I just want to see how rapidly this
     * explodes in order to decide what to do next.
     * 
     * Returns true if the name was added, or false if already existed
     */
    public boolean saveFediverseName(String name) {
        if (no(name))
            return false;
        name = name.trim();

        // lazy job of detecting garbage names
        if (name.indexOf("\n") != -1 || name.indexOf("\r") != -1 || name.indexOf("\t") != -1)
            return false;

        if (!apCache.allUserNames.contains(name)) {
            apCache.allUserNames.put(name, false);
            return true;
        }
        return false;
    }

    public void queueUserForRefresh(String apUserName, boolean force) {

        // if not on production we don't run ActivityPub stuff. (todo-1: need to make it optional)
        if (!prop.isActPubEnabled()) {
            return;
        }

        if (no(apUserName) || !apUserName.contains("@") || apUserName.toLowerCase().endsWith("@" + prop.getMetaHost()))
            return;

        saveFediverseName(apUserName);

        // unless force is true, don't add this apUserName to pending list
        if (!force && apCache.usersPendingRefresh.contains(apUserName)) {
            return;
        }

        // add as 'false' meaning the refresh is not yet done
        apCache.usersPendingRefresh.put(apUserName, false);
    }

    /* every 90 minutes read all the outboxes of all users */
    @Scheduled(fixedDelay = 90 * DateUtil.MINUTE_MILLIS)
    public void bigRefresh() {
        if (!prop.isDaemonsEnabled() || !MongoRepository.fullInit)
            return;

        if (bigRefresh)
            return;
        try {
            bigRefresh = true;
            refreshForeignUsers();
        } finally {
            bigRefresh = false;
        }
    }

    /*
     * Run every few seconds
     */
    @Scheduled(fixedDelay = 3 * 1000)
    public void userRefresh() {
        if (userRefresh || !prop.isActPubEnabled() || !prop.isDaemonsEnabled() || !MongoRepository.fullInit)
            return;

        try {
            userRefresh = true;

            try {
                saveUserNames();
            } catch (Exception e) {
                // log and ignore.
                log.error("saveUserNames", e);
            }

            refreshUsers();
        } catch (Exception e) {
            // log and ignore.
            log.error("refresh outboxes", e);
        } finally {
            userRefresh = false;
        }
    }

    private void refreshUsers() {
        if (!prop.isDaemonsEnabled())
            return;

        List<String> names = new ArrayList<>();
        for (String userName : apCache.usersPendingRefresh.keySet()) {
            names.add(userName);
        }

        // shuffle just to reduce likelyhood we might hit the same server too many times, and yes I realize
        // keySet wasn't even sorted to begin with
        // but nor do I want to count on it's randomness.
        Collections.shuffle(names);

        for (String userName : names) {
            if (!prop.isDaemonsEnabled())
                break;
            try {
                Boolean done = apCache.usersPendingRefresh.get(userName);
                if (done)
                    continue;

                /*
                 * This may hurt performance of the app so let's throttle it way back to a few seconds between
                 * loops. Also we don't want to put too much unwelcome load on other instances.
                 */
                Thread.sleep(4000);

                // flag as done (even if it fails we still want it flagged as done. no retries will be done).
                apCache.usersPendingRefresh.put(userName, true);

                loadForeignUser(null, userName);
            } catch (Exception e) {
                log.debug("Unable to load user: " + userName);
            }
        }
    }

    /*
     * This insures everything about all users is as up-to-date as possible by doing the equivalent an
     * importActor, but non-destructively to keep all existing nodes and posts
     * 
     * There are several kinds of ways these can fail like this: (so we need to be able to assign
     * statuses to accounts for these cases or at least a PASS/FAIL so the admin can optionally clean up
     * old/dead accounts)
     * 
     * get webFinger: Alice5401@mastodon.online 2021-08-20 17:33:48,996 DEBUG quanta.actpub.ActPubUtil
     * [threadPoolTaskExecutor-1] failed getting json: https://mastodon.online/users/Alice5401 -> 410
     * Gone: [{"error":"Gone"}]
     * 
     * and ths... get webFinger: reddit@societal.co 2021-08-20 17:33:46,824 DEBUG
     * quanta.actpub.ActPubUtil [threadPoolTaskExecutor-1] failed getting json:
     * https://societal.co/users/reddit -> Unexpected character ('<' (code 60)): expected a valid value
     * (JSON String, Number, Array, Object or token 'null', 'true' or 'false') at [Source:
     * (StringReader); line: 1, column: 2]
     * 
     * and this... DEBUG quanta.actpub.ActPubUtil [threadPoolTaskExecutor-1] failed getting json:
     * https://high.cat/users/archillect -> 401 Unauthorized: [Request not signed] 2021-08-20
     * 17:33:33,061
     */
    public void refreshActorPropsForAllUsers() {
        Runnable runnable = () -> {
            accountsRefreshed = 0;

            arun.run(ms -> {
                // Query to pull all user accounts
                Iterable<SubNode> accountNodes = read.findSubNodesByType(ms, MongoUtil.allUsersRootNode, NodeType.ACCOUNT.s());

                for (SubNode acctNode : accountNodes) {
                    // get userName, and skip over any that aren't foreign accounts
                    String userName = acctNode.getStr(NodeProp.USER.s());
                    if (no(userName) || !userName.contains("@"))
                        continue;

                    log.debug("rePullActor: " + userName);
                    String url = acctNode.getStr(NodeProp.ACT_PUB_ACTOR_ID.s());

                    try {
                        if (ok(url)) {
                            APObj actor = apUtil.getJson(ms, null, url, APConst.MTYPE_ACT_JSON);

                            if (ok(actor)) {
                                // we could double check userName, and bail if wrong, but this is not needed.
                                // String userName = getLongUserNameFromActor(actor);
                                apCache.actorsByUrl.put(url, actor);
                                apCache.actorsByUserName.put(userName, actor);

                                // since we're passing in the account node this importActor will basically just update the
                                // properties on it and save it.
                                importActor(ms, acctNode, actor);
                                // log.debug("import ok");
                                accountsRefreshed++;
                            }
                        }
                    } catch (Exception e) {
                        // todo-1: eating this for now.
                        log.debug("Failed getting actor: " + url);
                    }

                    // we don't want out VPS to think anything nefarious is happening (like we're doing a DDOS or
                    // something) so we
                    // sleep a full second between each user
                    Util.sleep(1000);
                }
                log.debug("Finished refreshActorPropsForAllUsers");
                return null;
            });
        };
        exec.run(runnable);
    }

    public void loadForeignUser(String userMakingRequest, String userName) {
        arun.run(ms -> {
            apLog.trace("Reload user outbox: " + userName);
            SubNode userNode = getAcctNodeByForeignUserName(ms, userMakingRequest, userName, false, true);
            if (no(userNode)) {
                // log.debug("Unable to getAccount Node for userName: "+userName);
                return null;
            }

            String actorUrl = userNode.getStr(NodeProp.ACT_PUB_ACTOR_ID.s());
            APObj actor = apUtil.getActorByUrl(ms, userMakingRequest, actorUrl);
            if (ok(actor)) {
                apOutbox.loadForeignOutbox(ms, userMakingRequest, actor, userNode, userName);

                /*
                 * I was going to load followerCounts into userNode, but I decided to just query them live when
                 * needed on the UserPreferences dialog
                 */
                int followerCount = apFollower.loadRemoteFollowers(ms, userMakingRequest, actor);
                int followingCount = apFollowing.loadRemoteFollowing(ms, userMakingRequest, actor);
            } else {
                log.debug("Unable to get actor from url: " + actorUrl);
            }
            return null;
        });
    }

    /* Saves all the pending new FediverseName objects we've accumulated */
    private void saveUserNames() {
        List<String> names = new LinkedList<>(apCache.allUserNames.keySet());

        for (String name : names) {
            Boolean done = apCache.allUserNames.get(name);
            if (done)
                continue;

            apCache.allUserNames.put(name, true);

            FediverseName fName = new FediverseName();
            fName.setName(name);
            fName.setCreateTime(Calendar.getInstance().getTime());

            /*
             * I'm not sure if it's faster to try to save and let the unique index block duplicates, or if it's
             * faster to check for dups before calling save here.
             */
            try {
                // log.debug("Saving Name: " + fName.getName());
                ops.save(fName);
                Thread.sleep(500);
            } catch (Exception e) {
                // this will happen for every duplicate. so A LOT!
            }
        }
    }

    /**
     * Returns number of userNamesPendingMessageRefresh that map to 'false' values
     */
    public int queuedUserCount() {
        int count = 0;
        for (String apUserName : apCache.usersPendingRefresh.keySet()) {
            Boolean done = apCache.usersPendingRefresh.get(apUserName);
            if (!done) {
                count++;
            }
        }
        return count;
    }

    public void refreshForeignUsers() {
        if (!prop.isActPubEnabled())
            return;

        lastRefreshForeignUsersCycleTime = DateUtil.getFormattedDate(new Date().getTime());
        refreshForeignUsersCycles++;
        refreshForeignUsersQueuedCount = 0;
        cycleOutboxQueryCount = 0;
        newPostsInCycle = 0;

        arun.run(ms -> {
            Iterable<SubNode> accountNodes = read.findSubNodesByType(ms, MongoUtil.allUsersRootNode, NodeType.ACCOUNT.s());

            for (SubNode node : accountNodes) {
                if (!prop.isDaemonsEnabled())
                    break;

                String userName = node.getStr(NodeProp.USER.s());
                if (no(userName) || !userName.contains("@"))
                    continue;

                refreshForeignUsersQueuedCount++;
                queueUserForRefresh(userName, true);
            }

            /* Setting the trending data to null causes it to refresh itself the next time it needs to. */
            synchronized (NodeSearchService.trendingFeedInfoLock) {
                NodeSearchService.trendingFeedInfo = null;
            }
            return null;
        });
    }

    /* This is just to pull in arbitary new users so our Fediverse feed is populated */
    public String crawlNewUsers() {
        if (!prop.isActPubEnabled())
            return "ActivityPub not enabled";

        return arun.run(ms -> {
            Iterable<SubNode> accountNodes = read.findSubNodesByType(ms, MongoUtil.allUsersRootNode, NodeType.ACCOUNT.s());

            // Load the list of all known users
            HashSet<String> knownUsers = new HashSet<>();
            for (SubNode node : accountNodes) {
                String userName = node.getStr(NodeProp.USER.s());
                if (no(userName))
                    continue;
                knownUsers.add(userName);
            }

            Iterable<FediverseName> recs = ops.findAll(FediverseName.class);
            int numLoaded = 0;
            for (FediverseName fName : recs) {
                try {
                    String userName = fName.getName();
                    log.debug("crawled user: " + userName);

                    // This userName may be an actor url, and if so we convert it to an actual username.
                    if (userName.startsWith("https://")) {
                        userName = apUtil.getLongUserNameFromActorUrl(ms, null, userName);
                        // log.debug("Converted to: " + userName);
                    }

                    if (knownUsers.contains(userName))
                        continue;

                    queueUserForRefresh(userName, true);
                    apCache.allUserNames.remove(userName);

                    if (++numLoaded > 250) {
                        break;
                    }
                } catch (Exception e) {
                    log.error("queueing FediverseName failed.", e);
                }
            }
            return "Queued some new users to crawl.";
        });
    }

    public String maintainForeignUsers() {
        if (!prop.isActPubEnabled())
            return "ActivityPub not enabled";

        return arun.run(ms -> {
            long totalDelCount = 0;
            Iterable<SubNode> accountNodes = read.findSubNodesByType(ms, MongoUtil.allUsersRootNode, NodeType.ACCOUNT.s());

            for (SubNode node : accountNodes) {
                String userName = node.getStr(NodeProp.USER.s());
                if (no(userName) || !userName.contains("@"))
                    continue;

                long delCount = delete.deleteOldActPubPosts(node, ms);
                totalDelCount += delCount;
                log.debug("User: " + userName + ". Deletes: " + delCount);
            }
            String message = "AP Maintence Complete. Deleted " + String.valueOf(totalDelCount) + " old posts.";
            log.debug(message);
            return message;
        });
    }

    public String getStatsReport() {
        StringBuilder sb = new StringBuilder();
        sb.append("\nActivityPub Stats:\n");
        sb.append("Accounts Refreshed: " + accountsRefreshed + "\n");
        sb.append("Refresh in progress: " + (userRefresh ? "true" : "false") + "\n");
        sb.append("Cached Usernames: " + apCache.allUserNames.size() + "\n");
        sb.append("Users Currently Queued (for refresh): " + queuedUserCount() + "\n");
        sb.append("Refresh Foreign Users Cycles: " + refreshForeignUsersCycles + "\n");
        sb.append("Last Foreign Users Refresh Time: " + lastRefreshForeignUsersCycleTime + "\n");
        sb.append("Number of Users Queued at last Cycle: " + refreshForeignUsersQueuedCount + "\n");
        sb.append("Cycle Foreign Outbox Queries: " + cycleOutboxQueryCount + "\n");
        sb.append("Total Foreign Outbox Queries: " + outboxQueryCount + "\n");
        sb.append("New Incomming Posts last cycle: " + newPostsInCycle + "\n");
        sb.append("Inbox Post count: " + inboxCount + "\n");
        return sb.toString();
    }

    public String dumpFediverseUsers() {
        StringBuilder sb = new StringBuilder();
        Iterable<FediverseName> recs = ops.findAll(FediverseName.class);
        int count = 0;
        for (FediverseName fName : recs) {
            sb.append(fName.getName());
            sb.append("\n");
            count++;
        }
        return "Fediverse Users: " + String.valueOf(count) + "\n\n" + sb.toString();
    }

    public List<String> getUserNamesFromNodeAcl(MongoSession ms, SubNode node) {
        // if we have no ACL return null
        if (no(node) || no(node.getAc()))
            return null;

        List<String> userNames = new LinkedList<>();

        /*
         * Lookup all userNames from the ACL info, to add them all to 'toUserNames'
         */
        for (String accntId : node.getAc().keySet()) {
            if (PrincipalName.PUBLIC.s().equals(accntId)) {
                continue;
            }

            try {
                // try to get account node from cache
                SubNode accntNode = apCache.acctNodesById.get(accntId);

                // if not in cache find the node and ADD to the cache.
                if (no(accntNode)) {
                    accntNode = read.getNode(ms, accntId);
                    apCache.acctNodesById.put(accntId, accntNode);
                }

                // get username off this node and add to 'toUserNames'
                if (ok(accntNode)) {
                    String userName = accntNode.getStr(NodeProp.USER.s());
                    userNames.add(userName);
                }
            } catch (Exception e) {
                log.error("Failed getting userName from accountId: " + accntId);
            }
        }
        return userNames;
    }

    public APList getTagListFromUserNames(String userDoingAction, List<String> userNames) {
        if (no(userNames) || userNames.isEmpty())
            return null;

        APList tagList = new APList();
        for (String userName : userNames) {
            try {
                String actorUrl = null;

                // if this is a local username
                if (!userName.contains("@")) {
                    actorUrl = apUtil.makeActorUrlForUserName(userName);
                }
                // else foreign userName
                else {
                    actorUrl = apUtil.getActorUrlFromForeignUserName(userDoingAction, userName);
                }

                if (no(actorUrl))
                    continue;

                // prepend character to make it like '@user@server.com'
                tagList.val(new APOMention(actorUrl, "@" + userName));
            }
            // log and continue if any loop (user) fails here.
            catch (Exception e) {
                log.debug("failed adding user to message: " + userName + " -> " + e.getMessage());
            }
        }
        return tagList;
    }
}
