package org.subnode.service;

import java.security.PublicKey;
import java.util.Arrays;
import java.util.Date;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executor;
import javax.servlet.http.HttpServletRequest;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.domain.Sort;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.subnode.AppController;
import org.subnode.actpub.AP;
import org.subnode.actpub.APList;
import org.subnode.actpub.APObj;
import org.subnode.actpub.ActPubConstants;
import org.subnode.actpub.ActPubFactory;
import org.subnode.actpub.ActPubObserver;
import org.subnode.actpub.ActPubUtil;
import org.subnode.config.AppProp;
import org.subnode.config.NodeName;
import org.subnode.model.client.NodeProp;
import org.subnode.model.client.NodeType;
import org.subnode.model.client.PrincipalName;
import org.subnode.model.client.PrivilegeType;
import org.subnode.mongo.CreateNodeLocation;
import org.subnode.mongo.MongoAuth;
import org.subnode.mongo.MongoCreate;
import org.subnode.mongo.MongoDelete;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.MongoUpdate;
import org.subnode.mongo.MongoUtil;
import org.subnode.mongo.RunAsMongoAdminEx;
import org.subnode.mongo.model.AccessControl;
import org.subnode.mongo.model.SubNode;
import org.subnode.util.DateUtil;
import org.subnode.util.EnglishDictionary;
import org.subnode.util.SubNodeUtil;
import org.subnode.util.ThreadLocals;
import org.subnode.util.ValContainer;
import org.subnode.util.XString;

@Component
public class ActPubService {
    public static final boolean ENGLISH_LANGUAGE_CHECK = false;
    public static final int MAX_MESSAGES = 10;
    public static final int MAX_FOLLOWERS = 20;
    public static int outboxQueryCount = 0;
    public static int cycleOutboxQueryCount = 0;
    public static int newPostsInCycle = 0;
    public static int refreshForeignUsersCycles = 0;
    public static int refreshForeignUsersQueuedCount = 0;
    public static String lastRefreshForeignUsersCycleTime = "n/a";
    public static int inboxCount = 0;
    private static final Logger log = LoggerFactory.getLogger(ActPubService.class);

    @Autowired
    private MongoUtil util;

    @Autowired
    private MongoRead read;

    @Autowired
    private MongoUpdate update;

    @Autowired
    private MongoCreate create;

    @Autowired
    private MongoDelete delete;

    @Autowired
    private ActPubFactory apFactory;

    @Autowired
    private EnglishDictionary englishDictionary;

    @Autowired
    private RunAsMongoAdminEx adminRunner;

    @Autowired
    private UserFeedService userFeedService;

    @Autowired
    private AclService acl;

    @Autowired
    private AppProp appProp;

    @Autowired
    private AttachmentService attachmentService;

    @Autowired
    private SubNodeUtil subNodeUtil;

    @Autowired
    private NodeEditService edit;

    @Autowired
    private MongoAuth auth;

    @Autowired
    private ActPubUtil apUtil;

    @Autowired
	@Qualifier("threadPoolTaskExecutor")
	private Executor executor;

    /*
     * Holds users for which messages need refreshing (false value) but sets value to 'true' once
     * completed
     */
    public static final ConcurrentHashMap<String, Boolean> userNamesPendingMessageRefresh =
            new ConcurrentHashMap<>();

    /* Cache Actor objects by UserName in memory only for now */
    public static final ConcurrentHashMap<String, APObj> actorCacheByUserName = new ConcurrentHashMap<>();

    /* Cache of user account node Ids by actor url */
    private static final ConcurrentHashMap<String, String> acctIdByActorUrl = new ConcurrentHashMap<>();

    /* Account Node by actor Url */
    private static final ConcurrentHashMap<String, SubNode> accountNodesByActorUrl = new ConcurrentHashMap<>();

    /* Account Node by User Name */
    private static final ConcurrentHashMap<String, SubNode> accountNodesByUserName = new ConcurrentHashMap<>();

    /* Account Node by node ID */
    private static final ConcurrentHashMap<String, SubNode> accountNodesById = new ConcurrentHashMap<>();

    /*
     * When 'node' has been created under 'parent' (by the sessionContext user) this will send a
     * notification to foreign servers.
     */
    public boolean sendNotificationForNodeEdit(MongoSession session, SubNode parent, SubNode node) {
        try {
            List<String> toUserNames = new LinkedList<>();

            boolean privateMessage = true;
            /*
             * Now we need to lookup all userNames from the ACL info, to add them all to 'toUserNames', and we
             * can avoid doing any work for the ones in 'toUserNamesSet', because we know they already are taken
             * care of (in the list)
             */
            if (node.getAc() != null) {
                for (String k : node.getAc().keySet()) {
                    if ("public".equals(k)) {
                        privateMessage = false;
                    } else {
                        // k will be a nodeId of an account node here.
                        SubNode accountNode = accountNodesById.get(k);
                        if (accountNode == null) {
                            accountNodesById.put(k, accountNode = read.getNode(session, k));
                        }

                        if (accountNode != null) {
                            String userName = accountNode.getStrProp(NodeProp.USER.s());
                            toUserNames.add(userName);
                        }
                    }
                }
            } else {
                return false;
            }

            // String apId = parent.getStringProp(NodeProp.ACT_PUB_ID.s());
            String inReplyTo = parent.getStrProp(NodeProp.ACT_PUB_OBJ_URL);
            APList attachments = createAttachmentsList(node);

            sendNote(session, toUserNames, ThreadLocals.getSessionContext().getUserName(), inReplyTo, node.getContent(),
                    attachments, subNodeUtil.getIdBasedUrl(node), privateMessage);
        } //
        catch (Exception e) {
            log.error("sendNote failed", e);
            throw new RuntimeException(e);
        }
        return true;
    }

    public APList createAttachmentsList(SubNode node) {
        APList attachments = null;

        String bin = node.getStrProp(NodeProp.BIN);
        String mime = node.getStrProp(NodeProp.BIN_MIME);

        if (bin != null && mime != null) {
            attachments = new APList().val(//
                    new APObj() //
                            .put("type", "Document") //
                            .put("mediaType", mime) //
                            .put("url", appProp.getProtocolHostAndPort() + "/f/id/" + node.getId().toHexString()));
        }

        return attachments;
    }

    /* Sends note outbound to other servers */
    public void sendNote(MongoSession session, List<String> toUserNames, String fromUser, String inReplyTo, String content,
            APList attachments, String noteUrl, boolean privateMessage) {

        String host = appProp.getMetaHost();
        String fromActor = null;

        /*
         * Per spec (and per Mastodon reverse engineering, we post the same message to all the inboxes that
         * need to see it
         */
        for (String toUserName : toUserNames) {
            // Ignore userNames that are not foreign server names
            if (!toUserName.contains("@")) {
                continue;
            }

            // Ignore userNames that are for our own host
            String userHost = apUtil.getHostFromUserName(toUserName);
            if (userHost.equals(host)) {
                continue;
            }

            APObj webFinger = apUtil.getWebFinger(toUserName);
            if (webFinger == null) {
                log.debug("Unable to get webfinger for " + toUserName);
                continue;
            }

            String toActorUrl = apUtil.getActorUrlFromWebFingerObj(webFinger);
            Object toActorObj = apUtil.getActorByUrl(toActorUrl);
            String inbox = AP.str(toActorObj, "inbox");

            /* lazy create fromActor here */
            if (fromActor == null) {
                fromActor = apUtil.makeActorUrlForUserName(fromUser);
            }

            APObj message = apFactory.newCreateMessageForNote(toUserNames, fromActor, inReplyTo, content, noteUrl, privateMessage,
                    attachments);

            apUtil.securePost(session, null, inbox, fromActor, message);
        }
    }

    /*
     * Reads in a user from the Fediverse with a name like: someuser@fosstodon.org
     * 
     * Returns account node of the user
     */
    public SubNode loadForeignUserByUserName(MongoSession session, String apUserName) {
        // return from cache if we already have the value cached
        SubNode acctNode = accountNodesByUserName.get(apUserName);
        if (acctNode != null) {
            return acctNode;
        }

        if (!apUserName.contains("@")) {
            log.debug("Invalid foreign user name: " + apUserName);
            return null;
        }

        /* First try to use the actor from cache, if we have it cached */
        Object actor = actorCacheByUserName.get(apUserName);

        // if we have actor object skip the step of getting it and import using it.
        if (actor != null) {
            acctNode = importActor(session, actor);
            accountNodesByUserName.put(apUserName, acctNode);
            return acctNode;
        }

        log.debug("Load foreign user: " + apUserName);
        APObj webFinger = apUtil.getWebFinger(apUserName);

        String actorUrl = apUtil.getActorUrlFromWebFingerObj(webFinger);
        if (actorUrl != null) {
            acctNode = loadForeignUserByActorUrl(session, actorUrl);
            accountNodesByUserName.put(apUserName, acctNode);
            return acctNode;
        }
        return null;
    }

    public SubNode loadForeignUserByActorUrl(MongoSession session, String actorUrl) {
        /* return node from cache if already cached */
        SubNode acctNode = accountNodesByActorUrl.get(actorUrl);
        if (acctNode != null) {
            return acctNode;
        }

        Object actor = apUtil.getActorByUrl(actorUrl);

        // if webfinger was successful, ensure the user is imported into our system.
        if (actor != null) {
            accountNodesByActorUrl.put(actorUrl, acctNode = importActor(session, actor));
        }
        return acctNode;
    }

    /*
     * Returns account node of the user, creating one if not already existing
     */
    public SubNode importActor(MongoSession session, Object actor) {
        String apUserName = apUtil.getLongUserNameFromActor(actor);

        apUserName = apUserName.trim();
        if (apUserName.endsWith("@" + appProp.getMetaHost().toLowerCase())) {
            log.debug("Can't import a user that's not from a foreign server.");
            return null;
        }
        log.debug("importing Actor: " + apUserName);

        // Try to get the userNode for this actor
        SubNode userNode = read.getUserNodeByUserName(session, apUserName);

        /*
         * If we don't have this user in our system, create them.
         */
        if (userNode == null) {
            userNode = util.createUser(session, apUserName, null, null, true);
        }

        boolean changed = false;
        Object icon = AP.obj(actor, "icon");
        if (icon != null) {
            String iconUrl = AP.str(icon, "url");
            if (iconUrl != null) {
                String curIconUrl = userNode.getStrProp(NodeProp.ACT_PUB_USER_ICON_URL.s());
                if (!iconUrl.equals(curIconUrl)) {
                    if (userNode.setProp(NodeProp.ACT_PUB_USER_ICON_URL.s(), iconUrl)) {
                        changed = true;
                    }
                }
            }
        }

        if (userNode.setProp(NodeProp.USER_BIO.s(), AP.str(actor, "summary")))
            changed = true;
        if (userNode.setProp(NodeProp.ACT_PUB_ACTOR_ID.s(), AP.str(actor, "id")))
            changed = true;
        if (userNode.setProp(NodeProp.ACT_PUB_ACTOR_INBOX.s(), AP.str(actor, "inbox")))
            changed = true;
        if (userNode.setProp(NodeProp.ACT_PUB_ACTOR_URL.s(), AP.str(actor, "url")))
            changed = true;

        if (changed) {
            update.save(session, userNode, false);
        }

        /* cache the account node id for this user by the actor url */
        String selfRefId = AP.str(actor, "id"); // actor url of 'actor' object, is the same as the 'id'
        acctIdByActorUrl.put(selfRefId, userNode.getId().toHexString());
        return userNode;
    }

    /*
     * Caller can pass in userNode if it's already available, but if not just pass null and the
     * apUserName will be used to look up the userNode.
     */
    public void refreshOutboxFromForeignServer(MongoSession session, Object actor, SubNode userNode, String apUserName) {

        if (userNode == null) {
            userNode = read.getUserNodeByUserName(session, apUserName);
        }

        SubNode outboxNode = read.getUserNodeByType(session, apUserName, userNode, "### Posts", NodeType.ACT_PUB_POSTS.s(), Arrays.asList(PrivilegeType.READ.s(), PrivilegeType.WRITE.s()));
        if (outboxNode == null) {
            log.debug("no outbox for user: " + apUserName);
            return;
        }

        /*
         * Query all existing known outbox items we have already saved for this foreign user
         */
        Iterable<SubNode> outboxItems = read.getSubGraph(session, outboxNode, null, 0);

        String outboxUrl = AP.str(actor, "outbox");
        Object outbox = getOutbox(outboxUrl);
        if (outbox == null) {
            log.debug("Unable to get outbox for AP user: " + apUserName);
            return;
        }

        /*
         * Generate a list of known AP IDs so we can ignore them and load only the unknown ones from the
         * foreign server
         */
        HashSet<String> apIdSet = new HashSet<>();
        for (SubNode n : outboxItems) {
            String apId = n.getStrProp(NodeProp.ACT_PUB_ID.s());
            if (apId != null) {
                apIdSet.add(apId);
            }
        }

        ValContainer<Integer> count = new ValContainer<>(0);
        final SubNode _userNode = userNode;

        iterateOrderedCollection(outbox, Integer.MAX_VALUE, obj -> {
            try {
                // if (obj != null) {
                // log.debug("saveNote: OBJ=" + XString.prettyPrint(obj));
                // }

                String apId = AP.str(obj, "id");
                if (!apIdSet.contains(apId)) {
                    Object object = AP.obj(obj, "object");

                    if (object != null) {
                        if (object instanceof String) {
                            // todo-1: handle boosts.
                            //
                            // log.debug("Not Handled: Object was a string: " + object + " in outbox item: "
                            // + XString.prettyPrint(obj));
                            // Example of what needs to be handled here is when 'obj' contains a 'boost' (retweet)
                            // {
                            // "id" : "https://dobbs.town/users/onan/statuses/105613730170001141/activity",
                            // "type" : "Announce",
                            // "actor" : "https://dobbs.town/users/onan",
                            // "published" : "2021-01-25T01:20:30Z",
                            // "to" : [ "https://www.w3.org/ns/activitystreams#Public" ],
                            // "cc" : [ "https://mastodon.sdf.org/users/stunder", "https://dobbs.town/users/onan/followers" ],
                            // "object" : "https://mastodon.sdf.org/users/stunder/statuses/105612925260202844"
                            // }
                        } //
                        else if ("Note".equals(AP.str(object, "type"))) {
                            try {
                                newPostsInCycle++;
                                saveNote(session, _userNode, outboxNode, object, true, true);
                                count.setVal(count.getVal() + 1);
                            } catch (Exception e) {
                                // log and ignore.
                                log.error("error in saveNode()", e);
                            }
                        } else {
                            log.debug("Object type not supported: " + XString.prettyPrint(obj));
                        }
                    }
                }
            } catch (Exception e) {
                log.error("Failes processing collection item.", e);
            }
            return (count.getVal() < MAX_MESSAGES);
        });
    }

    public void iterateOrderedCollection(Object collectionObj, int maxCount, ActPubObserver observer) {
        /*
         * To reduce load for our purposes we can limit to just getting 2 pages of results to update a user,
         * and really just one page would be ideal if not for the fact that some servers return an empty
         * first page and put the results in the 'last' page
         */
        int maxPageQueries = 2;
        int pageQueries = 0;

        // log.debug("interateOrderedCollection(): " + XString.prettyPrint(collectionObj));
        int count = 0;
        /*
         * We user apIdSet to avoid processing any dupliates, because the AP spec calls on us to do this and
         * doesn't guarantee it's own dedupliation
         */
        HashSet<String> apIdSet = new HashSet<>();

        /*
         * The collection object itself is allowed to have orderedItems, which if present we process, in
         * addition to the paging, although normally when the collection has the items it means it won't
         * have any paging
         */
        List<?> orderedItems = AP.list(collectionObj, "orderedItems");
        if (orderedItems != null) {
            /*
             * Commonly this will just be an array strings (like in a 'followers' collection on Mastodon)
             */
            for (Object apObj : orderedItems) {
                if (!observer.item(apObj)) {
                    return;
                }
                if (++count >= maxCount)
                    return;
            }
        }

        /*
         * Warning: There are times when even with only two items in the outbox Mastodon might send back an
         * empty array in the "first" page and the two items in teh "last" page, which makes no sense, but
         * it just means we have to read and deduplicate all the items from all pages to be sure we don't
         * end up with a empty array even when there ARE some
         */
        String firstPageUrl = AP.str(collectionObj, "first");
        if (firstPageUrl != null) {
            // log.debug("First Page Url: " + firstPageUrl);
            if (++pageQueries > maxPageQueries)
                return;
            Object ocPage = getOrderedCollectionPage(firstPageUrl);

            while (ocPage != null) {
                orderedItems = AP.list(ocPage, "orderedItems");
                for (Object apObj : orderedItems) {

                    // if apObj is an object (map)
                    if (AP.hasProps(apObj)) {
                        String apId = AP.str(apObj, "id");
                        // if no apId that's fine, just process item.
                        if (apId == null) {
                            if (!observer.item(apObj))
                                return;
                        }
                        // if no apId that's fine, just process item.
                        else if (!apIdSet.contains(apId)) {
                            // log.debug("Iterate Collection Item: " + apId);
                            if (!observer.item(apObj))
                                return;
                            apIdSet.add(apId);
                        }
                    }
                    // otherwise apObj is probably a 'String' but whatever it is we call 'item' on
                    // it.
                    else {
                        if (!observer.item(apObj))
                            return;
                    }
                    if (++count >= maxCount)
                        return;
                }

                String nextPage = AP.str(ocPage, "next");
                if (nextPage != null) {
                    if (++pageQueries > maxPageQueries)
                        return;
                    ocPage = getOrderedCollectionPage(nextPage);
                } else {
                    break;
                }
            }
        }

        String lastPageUrl = AP.str(collectionObj, "last");
        if (lastPageUrl != null) {
            // log.debug("Last Page Url: " + lastPageUrl);
            if (++pageQueries > maxPageQueries)
                return;
            Object ocPage = getOrderedCollectionPage(lastPageUrl);

            if (ocPage != null) {
                orderedItems = AP.list(ocPage, "orderedItems");

                for (Object apObj : orderedItems) {
                    // if apObj is an object (map)
                    if (AP.hasProps(apObj)) {
                        String apId = AP.str(apObj, "id");
                        // if no apId that's fine, just process item.
                        if (apId == null) {
                            if (!observer.item(apObj))
                                return;
                        }
                        // else process it with apId
                        else if (!apIdSet.contains(apId)) {
                            // log.debug("Iterate Collection Item: " + apId);
                            if (!observer.item(apObj))
                                return;
                            apIdSet.add(apId);
                        }
                    }
                    // otherwise apObj is probably a 'String' but whatever it is we call 'item' on
                    // it.
                    else {
                        if (!observer.item(apObj))
                            return;
                    }
                    if (++count >= maxCount)
                        return;
                }
            }
        }
    }

    public APObj getOutbox(String url) {
        if (url == null)
            return null;
        APObj outbox = apUtil.getJson(url, new MediaType("application", "ld+json"));
        outboxQueryCount++;
        cycleOutboxQueryCount++;
        // log.debug("Outbox: " + XString.prettyPrint(outbox));
        return outbox;
    }

    public APObj getOrderedCollectionPage(String url) {
        if (url == null)
            return null;
        APObj page = apUtil.getJson(url, new MediaType("application", "activity+json"));
        // log.debug("OrderedCollectionPage: " + XString.prettyPrint(outboxPage));
        return page;
    }

    /*
     * outbound message to follow/unfollow users on remote servers
     * 
     * apUserName is full user name like alice@quantizr.com
     */
    public void setFollowing(String apUserName, boolean following) {
        try {
            // admin doesn't follow/unfollow
            if (ThreadLocals.getSessionContext().isAdmin()) {
                return;
            }

            APObj webFingerOfUserBeingFollowed = apUtil.getWebFinger(apUserName);
            String actorUrlOfUserBeingFollowed = apUtil.getActorUrlFromWebFingerObj(webFingerOfUserBeingFollowed);

            adminRunner.run(session -> {
                String sessionActorUrl = apUtil.makeActorUrlForUserName(ThreadLocals.getSessionContext().getUserName());
                APObj followAction = new APObj();

                // send follow action
                if (following) {
                    followAction //
                            .put("@context", ActPubConstants.CONTEXT_STREAMS) //
                            .put("id", appProp.getProtocolHostAndPort() + "/follow/" + String.valueOf(new Date().getTime())) //
                            .put("type", "Follow") //
                            .put("actor", sessionActorUrl) //
                            .put("object", actorUrlOfUserBeingFollowed);
                }
                // send unfollow action
                else {
                    followAction //
                            .put("@context", ActPubConstants.CONTEXT_STREAMS) //
                            .put("id", appProp.getProtocolHostAndPort() + "/unfollow/" + String.valueOf(new Date().getTime())) //
                            .put("type", "Undo") //
                            .put("actor", sessionActorUrl) //
                            .put("object", new APObj() //
                                    .put("id",
                                            appProp.getProtocolHostAndPort() + "/unfollow-obj/"
                                                    + String.valueOf(new Date().getTime())) //
                                    .put("type", "Follow") //
                                    .put("actor", sessionActorUrl) //
                                    .put("object", actorUrlOfUserBeingFollowed));
                }

                APObj toActor = apUtil.getActorByUrl(actorUrlOfUserBeingFollowed);
                String toInbox = AP.str(toActor, "inbox");
                apUtil.securePost(session, null, toInbox, sessionActorUrl, followAction);
                return null;
            });
        } catch (Exception e) {
            log.debug("Set following Failed.");
        }
    }

    /*
     * Processes incoming INBOX requests for (Follow, Undo Follow), to be called by foreign servers to
     * follow a user on this server
     */
    public APObj processInboxPost(HttpServletRequest httpReq, Object payload) {
        String type = AP.str(payload, "type");

        // Process Create Action
        if ("Create".equals(type)) {
            return processCreateAction(httpReq, payload);
        }
        // Process Follow Action
        else if ("Follow".equals(type)) {
            return processFollowAction(payload, false);
        }
        // Process Undo Action (Unfollow, etc)
        else if ("Undo".equals(type)) {
            return processUndoAction(payload);
        }
        // else report unhandled
        else {
            log.debug("inbox (post) REST not handled:" + XString.prettyPrint(payload));
        }
        return null;
    }

    /* Process inbound undo actions (comming from foreign servers) */
    public APObj processUndoAction(Object payload) {
        Object object = AP.obj(payload, "object");
        if (object != null && "Follow".equals(AP.str(object, "type"))) {
            return processFollowAction(object, true);
        }
        return null;
    }

    public APObj processCreateAction(HttpServletRequest httpReq, Object payload) {
        APObj _ret = (APObj) adminRunner.run(session -> {

            String actorUrl = AP.str(payload, "actor");
            if (actorUrl == null) {
                log.debug("no 'actor' found on create action request posted object");
                return null;
            }

            APObj actorObj = apUtil.getActorByUrl(actorUrl);
            if (actorObj == null) {
                log.debug("Unable to load actorUrl: " + actorUrl);
                return null;
            }

            PublicKey pubKey = apUtil.getPublicKeyFromActor(actorObj);
            apUtil.verifySignature(httpReq, pubKey);

            Object object = AP.obj(payload, "object");
            if (object != null && "Note".equals(AP.str(object, "type"))) {
                return processCreateNote(session, actorUrl, actorObj, object);
            } else {
                log.debug("Unhandled Create action (object type not supported): " + XString.prettyPrint(payload));
            }
            return null;
        });
        return _ret;
    }

    /* obj is the 'Note' object */
    public APObj processCreateNote(MongoSession session, String actorUrl, Object actorObj, Object obj) {
        APObj ret = new APObj();

        /*
         * If this is a 'reply' post then parse the ID out of this, and if we can find that node by that id
         * then insert the reply under that, instead of the default without this id which is to put in
         * 'inbox'
         */
        String inReplyTo = AP.str(obj, "inReplyTo");

        /* This will say null unless inReplyTo is used to get an id to lookup */
        SubNode nodeBeingRepliedTo = null;

        /*
         * Detect if inReplyTo is formatted like this: 'https://domain.com/app?id=xxxxx' (proprietary URL
         * format for this server) and if so lookup the nodeBeingRepliedTo by using that nodeId
         */
        if (apUtil.isLocalUrl(inReplyTo)) {
            int lastIdx = inReplyTo.lastIndexOf("=");
            String replyToId = null;
            if (lastIdx != -1) {
                replyToId = inReplyTo.substring(lastIdx + 1);
                nodeBeingRepliedTo = read.getNode(session, replyToId, false);
            }
        }

        /*
         * If a foreign user is replying to a specific node, we put the reply under that node
         */
        if (nodeBeingRepliedTo != null) {
            saveNote(session, null, nodeBeingRepliedTo, obj, false, false);
        }
        /*
         * Otherwise the node is not a reply so we put it under POSTS node inside the foreign account node
         * on our server, and then we add 'sharing' to it for each person in the 'to/cc' so that this new
         * node will show up in those people's FEEDs
         */
        else {
            SubNode actorAccountNode = loadForeignUserByActorUrl(session, actorUrl);
            if (actorAccountNode != null) {
                String userName = actorAccountNode.getStrProp(NodeProp.USER.s());
                SubNode postsNode =
                        read.getUserNodeByType(session, userName, actorAccountNode, "### Posts", NodeType.ACT_PUB_POSTS.s(), null);
                saveNote(session, actorAccountNode, postsNode, obj, false, false);
            }
        }
        return ret;
    }

    /*
     * Saves inbound note comming from other foreign servers
     * 
     * system==true means we have a daemon thread doing the processing.
     * 
     * todo-1: when importing users in bulk (like at startup or the admin menu), some of these queries
     * in here will be redundant. Look for ways to optimize.
     * 
     * temp = true, means we are loading an outbox of a user and not, recieving a message specifically
     * to a local user so the node should be considered 'temporary' and can be deleted after a week or
     * so to clean the Db.
     */
    public void saveNote(MongoSession session, SubNode toAccountNode, SubNode parentNode, Object obj, boolean forcePublic,
            boolean temp) {
        String id = AP.str(obj, "id");

        /*
         * First look to see if there is a target node already existing for this so we don't add a duplicate
         */
        SubNode dupNode = read.findSubNodeByProp(session, parentNode.getPath(), NodeProp.ACT_PUB_ID.s(), id);
        if (dupNode != null) {
            // log.debug("duplicate ActivityPub post ignored: " + id);
            return;
        }

        Date published = AP.date(obj, "published");
        String inReplyTo = AP.str(obj, "inReplyTo");
        String contentHtml = AP.str(obj, "content");
        String objUrl = AP.str(obj, "url");
        String objAttributedTo = AP.str(obj, "attributedTo");
        String objType = AP.str(obj, "type");
        Boolean sensitive = AP.bool(obj, "sensitive");

        // Ignore non-english for now (later we can make this a user-defined language selection)
        String lang = "0";
        Object context = AP.obj(obj, "@context");
        if (context != null) {
            String language = AP.str(context, "@language");
            if (language != null) {
                lang = language;
                if (!"en".equalsIgnoreCase(language)) {
                    log.debug("Ignoring Non-English");
                    return;
                }
            }
        }

        if (ENGLISH_LANGUAGE_CHECK) {
            if (lang.equals("0")) {
                if (!englishDictionary.isEnglish(contentHtml)) {
                    log.debug("Ignored Foreign: " + XString.prettyPrint(obj));
                    return;
                } else {
                    lang = "en-ck3";
                }
            }
        }

        // foreign account will own this node, this may be passed if it's known or null can be passed in.
        if (toAccountNode == null) {
            toAccountNode = loadForeignUserByActorUrl(session, objAttributedTo);
        }
        SubNode newNode =
                create.createNode(session, parentNode, null, null, 0L, CreateNodeLocation.FIRST, null, toAccountNode.getId(), true);

        // todo-1: need a new node prop type that is just 'html' and tells us to render
        // content as raw html if set, or for now
        // we could be clever and just detect if it DOES have tags and does NOT have
        // '```'
        newNode.setContent(contentHtml);
        newNode.setModifyTime(published);

        if (sensitive != null && sensitive.booleanValue()) {
            newNode.setProp(NodeProp.ACT_PUB_SENSITIVE.s(), "y");
        }

        if (temp) {
            newNode.setProp(NodeProp.TEMP.s(), "1");
        }

        newNode.setProp(NodeProp.ACT_PUB_ID.s(), id);
        newNode.setProp(NodeProp.ACT_PUB_OBJ_URL.s(), objUrl);
        newNode.setProp(NodeProp.ACT_PUB_OBJ_INREPLYTO.s(), inReplyTo);
        newNode.setProp(NodeProp.ACT_PUB_OBJ_TYPE.s(), objType);
        newNode.setProp(NodeProp.ACT_PUB_OBJ_ATTRIBUTED_TO.s(), objAttributedTo);

        // part of troubleshooting the non-english language detection
        // newNode.setProp("lang", lang);

        shareToAllObjectRecipients(session, newNode, obj, "to");
        shareToAllObjectRecipients(session, newNode, obj, "cc");

        if (forcePublic) {
            acl.addPrivilege(session, newNode, PrincipalName.PUBLIC.s(),
                    Arrays.asList(PrivilegeType.READ.s(), PrivilegeType.WRITE.s()), null);
        }

        // log.debug("saveNote: OBJ=" + XString.prettyPrint(obj));

        update.save(session, newNode);
        addAttachmentIfExists(session, newNode, obj);

        try {
            userFeedService.pushNodeUpdateToBrowsers(session, newNode);
        } catch (Exception e) {
            log.error("pushNodeUpdateToBrowsers failed (ignoring error)", e);
        }
    }

    /*
     * Adds node sharing (ACL) entries for all recipients (i.e. propName==to | cc)
     * 
     * The node save is expected to be done external to this function after this function runs.
     */
    private void shareToAllObjectRecipients(MongoSession session, SubNode node, Object obj, String propName) {
        List<?> list = AP.list(obj, propName);
        if (list != null) {
            /* Build up all the access controls */
            for (Object to : list) {
                if (to instanceof String) {
                    String shareToUrl = (String) to;

                    /* The spec allows either a 'followers' URL here or an 'actor' URL here */
                    shareToUsersForUrl(session, node, shareToUrl);
                } else {
                    log.debug("to list entry not supported: " + to.getClass().getName());
                }
            }
        }
    }

    /*
     * Reads the object from 'url' to determine if it's a 'followers' URL or an 'actor' URL, and then
     * shares the node to either all the followers or the specific actor
     */
    private void shareToUsersForUrl(MongoSession session, SubNode node, String url) {
        // log.debug("shareToUsersForUrl: " + url);

        if (url.endsWith("#Public")) {
            node.safeGetAc().put("public", new AccessControl(null, PrivilegeType.READ.s()));
            return;
        }

        /*
         * if url does not contain "/followers" then the best first try is to assume it's an actor url and
         * try that first
         */
        if (!url.contains("/followers")) {
            shareNodeToActorByUrl(session, node, url);
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
                APObj followersObj = apUtil.getJson(url, new MediaType("application", "activity+json"));
                if (followersObj != null) {
                    iterateOrderedCollection(followersObj, MAX_FOLLOWERS, obj -> {
                        /*
                         * Mastodon seems to have the followers items as strings, which are the actor urls of the followers.
                         */
                        if (obj instanceof String) {
                            String followerActorUrl = (String) obj;
                            shareNodeToActorByUrl(session, node, followerActorUrl);
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
    private void shareNodeToActorByUrl(MongoSession session, SubNode node, String actorUrl) {
        /*
         * Yes we tolerate for this to execute with the 'public' designation in place of an actorUrl here
         */
        if (actorUrl.endsWith("#Public")) {
            node.safeGetAc().put("public", new AccessControl(null, PrivilegeType.READ.s()));
            return;
        }

        /* try to get account id from cache first */
        String acctId = acctIdByActorUrl.get(actorUrl);

        /*
         * if acctId not found in cache load foreign user (will cause it to also get cached)
         */
        if (acctId == null) {
            SubNode acctNode = null;

            if (apUtil.isLocalActorUrl(actorUrl)) {
                String longUserName = apUtil.getLongUserNameFromActorUrl(actorUrl);
                acctNode = read.getUserNodeByUserName(session, longUserName);
            } else {
                /*
                 * todo-1: this is contributing to our unwanted CRAWLER effect (FediCrawler!) chain reaction. The
                 * rule here should be either don't load foreign users whose outboxes you don't plan to load or else
                 * have some property on the node that designates if we need to read the actual outbox or if you DO
                 * want to add a user and not load their outbox.
                 */
                // acctNode = loadForeignUserByActorUrl(session, actorUrl);
            }

            if (acctNode != null) {
                acctId = acctNode.getId().toHexString();
            }
        }

        if (acctId != null) {
            node.safeGetAc().put(acctId, new AccessControl(null, PrivilegeType.READ.s() + "," + PrivilegeType.WRITE.s()));
        }
    }

    private void addAttachmentIfExists(MongoSession session, SubNode node, Object obj) {
        List<?> attachments = AP.list(obj, "attachment");

        if (attachments == null)
            return;

        for (Object att : attachments) {
            String mediaType = AP.str(att, "mediaType");
            String url = AP.str(att, "url");

            if (mediaType != null && url != null) {
                attachmentService.readFromUrl(session, url, node.getId().toHexString(), mediaType, -1, false);

                // for now we only support one attachment so break out after uploading one.
                break;
            }
        }
    }

    /*
     * Process inbound 'Follow' actions (comming from foreign servers). This results in the follower an
     * account node in our local DB created if not already existing, and then a FRIEND node under his
     * FRIENDS_LIST created to represent the person he's following, if not already existing.
     * 
     * If 'unFollow' is true we actually do an unfollow instead of a follow.
     */
    public APObj processFollowAction(Object followAction, boolean unFollow) {

        return (APObj) adminRunner.run(session -> {
            // Actor URL of actor doing the following
            String followerActorUrl = AP.str(followAction, "actor");
            if (followerActorUrl == null) {
                log.debug("no 'actor' found on follows action request posted object");
                return null;
            }

            APObj followerActorObj = apUtil.getActorByUrl(followerActorUrl);

            // log.debug("getLongUserNameFromActorUrl: " + actorUrl + "\n" +
            // XString.prettyPrint(actor));
            String followerUserName = apUtil.getLongUserNameFromActor(followerActorObj);
            SubNode followerAccountNode = loadForeignUserByUserName(session, followerUserName);
            userEncountered(followerUserName, false);

            // Actor being followed (local to our server)
            String actorBeingFollowedUrl = AP.str(followAction, "object");
            if (actorBeingFollowedUrl == null) {
                log.debug("no 'object' found on follows action request posted object");
                return null;
            }

            String userToFollow = apUtil.getLocalUserNameFromActorUrl(actorBeingFollowedUrl);
            if (userToFollow == null) {
                log.debug("unable to get a user name from actor url: " + actorBeingFollowedUrl);
                return null;
            }

            // get the Friend List of the follower
            SubNode followerFriendList = read.getUserNodeByType(session, followerUserName, null, null, NodeType.FRIEND_LIST.s(), null);

            /*
             * lookup to see if this followerFriendList node already has userToFollow already under it
             */
            SubNode friendNode = read.findFriendOfUser(session, followerFriendList, userToFollow);
            if (friendNode == null) {
                if (!unFollow) {
                    friendNode = edit.createFriendNode(session, followerFriendList, userToFollow, followerActorUrl);
                    // userFeedService.sendServerPushInfo(localUserName,
                    // new NotificationMessage("apReply", null, contentHtml, toUserName));
                }
            } else {
                // if this is an unfollow delete the friend node
                if (unFollow) {
                    delete.deleteNode(session, friendNode, false);
                }
            }

            String privateKey = apUtil.getPrivateKey(session, userToFollow);

            /* Protocol says we need to send this acceptance back */
            Runnable runnable = () -> {
                try {
                    // todo-0: what's this sleep doing? I'm pretty sure I just wanted to give the caller (i.e. some
                    // remote Fedi instance) a chance to get a return code back for this call before posting 
                    // back to it
                    Thread.sleep(2000);

                    // Must send either Accept or Reject. Currently we auto-accept all.
                    APObj acceptFollow = new APObj() //
                            .put("@context", ActPubConstants.CONTEXT_STREAMS) //
                            .put("summary", "Accepted " + (unFollow ? "unfollow" : "follow") + " request") //
                            .put("type", "Accept") //
                            .put("actor", actorBeingFollowedUrl) //
                            .put("object", new APObj() //
                                    .put("type", unFollow ? "Undo" : "Follow") //
                                    .put("actor", followerActorUrl) //
                                    .put("object", actorBeingFollowedUrl)); //

                    String followerInbox = AP.str(followerActorObj, "inbox");

                    // log.debug("Sending Accept of Follow Request to inbox " + followerInbox);
                    apUtil.securePost(session, privateKey, followerInbox, actorBeingFollowedUrl, acceptFollow);
                } catch (Exception e) {
                }
            };
            executor.execute(runnable);
            return null;
        });
    }

    public APObj generateFollowers(String userName) {
        String url = appProp.getProtocolHostAndPort() + ActPubConstants.PATH_FOLLOWERS + "/" + userName;
        Long totalItems = getFollowersCount(userName);

        return new APObj() //
                .put("@context", ActPubConstants.CONTEXT_STREAMS) //
                .put("id", url) //
                .put("type", "OrderedCollection") //
                .put("totalItems", totalItems) //
                .put("first", url + "?page=true") //
                .put("last", url + "?min_id=0&page=true");
    }

    public APObj generateFollowing(String userName) {
        String url = appProp.getProtocolHostAndPort() + ActPubConstants.PATH_FOLLOWING + "/" + userName;
        Long totalItems = getFollowingCount(userName);

        return new APObj() //
                .put("@context", ActPubConstants.CONTEXT_STREAMS) //
                .put("id", url) //
                .put("type", "OrderedCollection") //
                .put("totalItems", totalItems) //
                .put("first", url + "?page=true") //
                .put("last", url + "?min_id=0&page=true");
    }

    public APObj generateOutbox(String userName) {
        // log.debug("Generate outbox for userName: " + userName);
        String url = appProp.getProtocolHostAndPort() + ActPubConstants.PATH_OUTBOX + "/" + userName;
        Long totalItems = getOutboxItemCount(userName, "public");

        return new APObj() //
                .put("@context", ActPubConstants.CONTEXT_STREAMS) //
                .put("id", url) //
                .put("type", "OrderedCollection") //
                .put("totalItems", totalItems) //
                .put("first", url + "?page=true") //
                .put("last", url + "?min_id=0&page=true");
    }

    /*
     * userName represents the person whose outbox is being QUERIED, and the identity of the user DOING
     * the querying will come from the http header:
     * 
     * todo-1: For now we just query the PUBLIC shares from the outbox, and verify that public query
     * works before we try to figure out how to do private auth comming from specific user(s)
     */
    public Long getOutboxItemCount(final String userName, String sharedTo) {
        Long totalItems = (Long) adminRunner.run(mongoSession -> {
            long count = 0;
            SubNode userNode = read.getUserNodeByUserName(null, userName);
            if (userNode != null) {
                List<String> sharedToList = new LinkedList<>();
                sharedToList.add(sharedTo);
                count = auth.countSubGraphByAclUser(mongoSession, null, sharedToList, userNode.getOwner());
            }
            return Long.valueOf(count);
        });
        return totalItems;
    }

    /*
     * if minId=="0" that means "last page", and if minId==null it means first page
     */
    public APObj generateOutboxPage(String userName, String minId) {
        APList items = getOutboxItems(userName, "public", minId);

        // this is a self-reference url (id)
        String url = appProp.getProtocolHostAndPort() + ActPubConstants.PATH_OUTBOX + "/" + userName + "?min_id=" + minId
                + "&page=true";

        return new APObj() //
                .put("@context", ActPubConstants.CONTEXT_STREAMS) //
                .put("partOf", appProp.getProtocolHostAndPort() + ActPubConstants.PATH_OUTBOX + "/" + userName) //
                .put("id", url) //
                .put("type", "OrderedCollectionPage") //
                .put("orderedItems", items) //
                .put("totalItems", items.size());
    }

    public APObj generateFollowersPage(String userName, String minId) {
        List<String> followers = getFollowers(userName, minId);

        // this is a self-reference url (id)
        String url = appProp.getProtocolHostAndPort() + ActPubConstants.PATH_FOLLOWERS + "/" + userName + "?page=true";
        if (minId != null) {
            url += "&min_id=" + minId;
        }
        return new APObj() //
                .put("@context", ActPubConstants.CONTEXT_STREAMS) //
                .put("id", url) //
                .put("type", "OrderedCollectionPage") //
                .put("orderedItems", followers) //
                .put("partOf", appProp.getProtocolHostAndPort() + ActPubConstants.PATH_FOLLOWERS + "/" + userName)//
                .put("totalItems", followers.size());
    }

    public APObj generateFollowingPage(String userName, String minId) {
        List<String> following = getFollowing(userName, minId);

        // this is a self-reference url (id)
        String url = appProp.getProtocolHostAndPort() + ActPubConstants.PATH_FOLLOWING + "/" + userName + "?page=true";
        if (minId != null) {
            url += "&min_id=" + minId;
        }
        return new APObj() //
                .put("@context", ActPubConstants.CONTEXT_STREAMS) //
                .put("id", url) //
                .put("type", "OrderedCollectionPage") //
                .put("orderedItems", following) //
                .put("partOf", appProp.getProtocolHostAndPort() + ActPubConstants.PATH_FOLLOWING + "/" + userName)//
                .put("totalItems", following.size());
    }

    public List<String> getFollowers(String userName, String minId) {
        final List<String> followers = new LinkedList<>();

        adminRunner.run(session -> {
            Iterable<SubNode> iter = read.findFollowersOfUser(session, userName);

            for (SubNode n : iter) {
                // log.debug("Follower found: " + XString.prettyPrint(n));
                followers.add(n.getStrProp(NodeProp.ACT_PUB_ACTOR_URL));
            }
            return null;
        });

        return followers;
    }

    public List<String> getFollowing(String userName, String minId) {
        final List<String> following = new LinkedList<>();

        adminRunner.run(session -> {
            Iterable<SubNode> iter = read.findFollowingOfUser(session, userName);

            for (SubNode n : iter) {
                // log.debug("Follower found: " + XString.prettyPrint(n));
                following.add(n.getStrProp(NodeProp.ACT_PUB_ACTOR_URL));
            }
            return null;
        });

        return following;
    }

    public Long getFollowersCount(String userName) {
        return (Long) adminRunner.run(session -> {
            Long count = read.countFollowersOfUser(session, userName);
            return count;
        });
    }

    public Long getFollowingCount(String userName) {
        return (Long) adminRunner.run(session -> {
            Long count = read.countFollowingOfUser(session, userName);
            return count;
        });
    }

    /*
     * Generates an Actor object for one of our own local users
     */
    public APObj generateActor(String userName) {
        String host = appProp.getProtocolHostAndPort();

        try {
            SubNode userNode = read.getUserNodeByUserName(null, userName);
            if (userNode != null) {
                String publicKey = userNode.getStrProp(NodeProp.CRYPTO_KEY_PUBLIC.s());
                if (publicKey == null) {
                    throw new RuntimeException("User has no crypto keys. This means they have never logged in?");
                }

                String avatarMime = userNode.getStrProp(NodeProp.BIN_MIME.s());
                String avatarVer = userNode.getStrProp(NodeProp.BIN.s());
                String avatarUrl = appProp.getProtocolHostAndPort() + AppController.API_PATH + "/bin/avatar" + "?nodeId="
                        + userNode.getId().toHexString() + "&v=" + avatarVer;

                APObj actor = new APObj();

                actor.put("@context", new APList() //
                        .val(ActPubConstants.CONTEXT_STREAMS) //
                        .val(ActPubConstants.CONTEXT_SECURITY));

                /*
                 * Note: this is a self-reference, and must be identical to the URL that returns this object
                 */
                actor.put("id", apUtil.makeActorUrlForUserName(userName));
                actor.put("type", "Person");
                actor.put("preferredUsername", userName);
                actor.put("name", userName); // this should be ordinary name (first last)

                actor.put("icon", new APObj() //
                        .put("type", "Image") //
                        .put("mediaType", avatarMime) //
                        .put("url", avatarUrl));

                String headerImageMime = userNode.getStrProp(NodeProp.BIN_MIME.s() + "Header");
                if (headerImageMime != null) {
                    String headerImageVer = userNode.getStrProp(NodeProp.BIN.s() + "Header");
                    if (headerImageVer != null) {
                        String headerImageUrl = appProp.getProtocolHostAndPort() + AppController.API_PATH + "/bin/profileHeader"
                                + "?nodeId=" + userNode.getId().toHexString() + "&v=" + headerImageVer;

                        actor.put("image", new APObj() //
                                .put("type", "Image") //
                                .put("mediaType", headerImageMime) //
                                .put("url", headerImageUrl));
                    }
                }

                actor.put("summary", userNode.getStrProp(NodeProp.USER_BIO.s()));
                actor.put("inbox", host + ActPubConstants.PATH_INBOX + "/" + userName); //
                actor.put("outbox", host + ActPubConstants.PATH_OUTBOX + "/" + userName); //
                actor.put("followers", host + ActPubConstants.PATH_FOLLOWERS + "/" + userName);
                actor.put("following", host + ActPubConstants.PATH_FOLLOWING + "/" + userName);

                /*
                 * Note: Mastodon requests the wrong url when it needs this but we compansate with a redirect to tis
                 * in our ActPubController. We tolerate Mastodon breaking spec here.
                 */
                actor.put("url", host + "/u/" + userName + "/home");

                actor.put("endpoints", new APObj().put("sharedInbox", host + ActPubConstants.PATH_INBOX));

                actor.put("publicKey", new APObj() //
                        .put("id", AP.str(actor, "id") + "#main-key") //
                        .put("owner", AP.str(actor, "id")) //
                        .put("publicKeyPem", "-----BEGIN PUBLIC KEY-----\n" + publicKey + "\n-----END PUBLIC KEY-----\n"));

                actor.put("supportsFriendRequests", true);

                // log.debug("Reply with Actor: " + XString.prettyPrint(actor));
                return actor;
            }
        } catch (Exception e) {
            log.error("actor query failed", e);
            throw new RuntimeException(e);
        }
        return null;
    }

    /*
     * todo-1: Security isn't implemented on this call yet, but the only caller to this is passing
     * "public" as 'sharedTo' so we are safe to implement this outbox currently as only able to send
     * back public info.
     */
    public APList getOutboxItems(String userName, String sharedTo, String minId) {
        String host = appProp.getProtocolHostAndPort();
        APList retItems = null;
        String nodeIdBase = host + "/app?id=";

        try {
            SubNode userNode = read.getUserNodeByUserName(null, userName);
            if (userNode == null) {
                return null;
            }

            retItems = (APList) adminRunner.run(mongoSession -> {
                APList items = new APList();
                int MAX_PER_PAGE = 25;
                boolean collecting = false;

                if (minId == null) {
                    collecting = true;
                }

                List<String> sharedToList = new LinkedList<String>();
                sharedToList.add(sharedTo);

                for (SubNode child : auth.searchSubGraphByAclUser(mongoSession, null, sharedToList,
                        Sort.by(Sort.Direction.DESC, SubNode.FIELD_MODIFY_TIME), MAX_PER_PAGE, userNode.getOwner())) {

                    if (items.size() >= MAX_PER_PAGE) {
                        // ocPage.setPrev(outboxBase + "?page=" + String.valueOf(pgNo - 1));
                        // ocPage.setNext(outboxBase + "?page=" + String.valueOf(pgNo + 1));
                        break;
                    }

                    if (collecting) {
                        String hexId = child.getId().toHexString();
                        String published = DateUtil.isoStringFromDate(child.getModifyTime());
                        String actor = apUtil.makeActorUrlForUserName(userName);

                        items.add(new APObj() //
                                .put("id", nodeIdBase + hexId + "&create=t") //
                                .put("type", "Create") //
                                .put("actor", actor) //
                                .put("published", published) //
                                .put("to", new APList().val(ActPubConstants.CONTEXT_STREAMS + "#Public")) //
                                // .put("cc", ...) //
                                .put("object", new APObj() //
                                        .put("id", nodeIdBase + hexId) //
                                        .put("type", "Note") //
                                        .put("summary", null) //
                                        .put("replyTo", null) //
                                        .put("published", published) //
                                        .put("url", nodeIdBase + hexId) //
                                        .put("attributedTo", actor) //
                                        .put("to", new APList().val(ActPubConstants.CONTEXT_STREAMS + "#Public")) //
                                        // .put("cc", ...) //
                                        .put("sensitive", false) //
                                        .put("content", child.getContent())//
                        ));
                    }
                }

                return items;
            });

        } catch (Exception e) {
            log.error("failed generating outbox page: ", e);
            throw new RuntimeException(e);
        }
        return retItems;
    }

    /*
     * Every node getting deleted will call into here (via a hook in MongoEventListener), so we can do
     * whatever we need to in this hook, which for now is just used to manage unfollowing a Friend if a
     * friend is deleted, but later will also entail (todo-1) deleting nodes that were posted to foreign
     * servers by posting an 'undo' action to the foreign servers
     */
    public void deleteNodeNotify(ObjectId nodeId) {
        adminRunner.run(session -> {
            SubNode node = read.getNode(session, nodeId);
            if (node != null && node.getType().equals(NodeType.FRIEND.s())) {
                String friendUserName = node.getStrProp(NodeProp.USER.s());
                if (friendUserName != null) {
                    // if a foreign user, update thru ActivityPub
                    if (friendUserName.contains("@")) {
                        setFollowing(friendUserName, false);
                    }
                }
            }
            return null;
        });
    }

    /*
     * Be careful, becasue any user you queue into here will have their outbox loaded into Quanta, and
     * it's easy to set off a chain reaction where more users keep comming in like a FediCrawler
     */
    public void userEncountered(String apUserName, boolean force) {
        if (force) {
            queueUserForRefresh(apUserName, force);
        }
    }

    public void queueUserForRefresh(String apUserName, boolean force) {

        // if not on production we don't run ActivityPub stuff. (todo-1: need to make it optional)
        if (!appProp.getProfileName().equals("prod")) {
            return;
        }

        if (apUserName == null || !apUserName.contains("@") || apUserName.toLowerCase().endsWith("@" + appProp.getMetaHost()))
            return;

        if (!force) {
            // if already added, don't add again.
            if (userNamesPendingMessageRefresh.contains(apUserName))
                return;
        }

        // add as 'false' meaning the refresh is not yet done
        userNamesPendingMessageRefresh.put(apUserName, false);
    }

    /* every 30 minutes ping all the outboxes */
    @Scheduled(fixedDelay = 30 * DateUtil.MINUTE_MILLIS)
    public void bigRefresh() {
        refreshForeignUsers();
    }

    public static int queuedUserCount() {
        int count = 0;
        for (String apUserName : userNamesPendingMessageRefresh.keySet()) {
            Boolean done = userNamesPendingMessageRefresh.get(apUserName);
            if (!done) {
                count++;
            }
        }
        return count;
    }

    /* Run every few seconds */
    @Scheduled(fixedDelay = 3 * 1000)
    public void messageRefresh() {
        if (!appProp.getProfileName().equals("prod"))
            return;

        try {
            for (String apUserName : userNamesPendingMessageRefresh.keySet()) {
                Boolean done = userNamesPendingMessageRefresh.get(apUserName);
                if (done)
                    continue;

                // flag as done.
                userNamesPendingMessageRefresh.put(apUserName, true);

                final String _apUserName = apUserName;
                adminRunner.run(session -> {
                    // log.debug("Reload user outbox: " + _apUserName);
                    SubNode userNode = loadForeignUserByUserName(session, _apUserName);
                    if (userNode != null) {
                        String actorUrl = userNode.getStrProp(NodeProp.ACT_PUB_ACTOR_URL.s());
                        APObj actor = apUtil.getActorByUrl(actorUrl);
                        if (actor != null) {
                            refreshOutboxFromForeignServer(session, actor, userNode, _apUserName);
                        } else {
                            log.debug("Unable to get cached actor from url: " + actorUrl);
                        }
                    }
                    return null;
                });
            }
        } catch (Exception e) {
            // log and ignore.
            log.error("messageRefreshFailed", e);
        }
    }

    public void refreshForeignUsers() {
        if (!appProp.getProfileName().equals("prod"))
            return;

        lastRefreshForeignUsersCycleTime = DateUtil.getFormattedDate(new Date().getTime());
        refreshForeignUsersCycles++;
        refreshForeignUsersQueuedCount = 0;
        cycleOutboxQueryCount = 0;
        newPostsInCycle = 0;

        adminRunner.run(session -> {
            Iterable<SubNode> accountNodes =
                    read.findTypedNodesUnderPath(session, NodeName.ROOT_OF_ALL_USERS, NodeType.ACCOUNT.s());

            for (SubNode node : accountNodes) {
                String userName = node.getStrProp(NodeProp.USER.s());
                if (userName == null || !userName.contains("@"))
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

    public static String getStatsReport() {
        StringBuilder sb = new StringBuilder();
        sb.append("\nActivityPub Stats:\n");
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
}
