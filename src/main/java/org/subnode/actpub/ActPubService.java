package org.subnode.actpub;

import java.security.PublicKey;
import java.util.Arrays;
import java.util.Date;
import java.util.LinkedList;
import java.util.List;
import java.util.concurrent.Executor;
import javax.servlet.http.HttpServletRequest;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.subnode.AppController;
import org.subnode.config.AppProp;
import org.subnode.config.NodeName;
import org.subnode.model.client.NodeProp;
import org.subnode.model.client.NodeType;
import org.subnode.model.client.PrincipalName;
import org.subnode.model.client.PrivilegeType;
import org.subnode.mongo.CreateNodeLocation;
import org.subnode.mongo.MongoCreate;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.MongoUpdate;
import org.subnode.mongo.MongoUtil;
import org.subnode.mongo.RunAsMongoAdminEx;
import org.subnode.mongo.model.AccessControl;
import org.subnode.mongo.model.SubNode;
import org.subnode.service.AclService;
import org.subnode.service.AttachmentService;
import org.subnode.service.NodeSearchService;
import org.subnode.service.UserFeedService;
import org.subnode.util.DateUtil;
import org.subnode.util.EnglishDictionary;
import org.subnode.util.SubNodeUtil;
import org.subnode.util.ThreadLocals;
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
    private ActPubFactory apFactory;

    @Autowired
    private ActPubCache apCache;

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
    private ActPubUtil apUtil;

    @Autowired
    private ActPubFollowing apFollowing;

    @Autowired
    private ActPubOutbox apOutbox;

    @Autowired
    @Qualifier("threadPoolTaskExecutor")
    private Executor executor;

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
                        SubNode accntNode = apCache.acctNodesById.get(k);

                        if (accntNode == null) {
                            accntNode = read.getNode(session, k);
                            apCache.acctNodesById.put(k, accntNode);
                        }

                        if (accntNode != null) {
                            String userName = accntNode.getStrProp(NodeProp.USER.s());
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
                            .put(AP.type, APType.Document) //
                            .put(AP.mediaType, mime) //
                            .put(AP.url, appProp.getProtocolHostAndPort() + "/f/id/" + node.getId().toHexString()));
        }

        return attachments;
    }

    /* Sends note outbound to other servers */
    public void sendNote(MongoSession session, List<String> toUserNames, String fromUser, String inReplyTo, String content,
            APList attachments, String noteUrl, boolean privateMessage) {

        String host = appProp.getMetaHost();
        String fromActor = null;

        /*
         * Post the same message to all the inboxes that need to see it
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
            APObj toActorObj = apUtil.getActorByUrl(toActorUrl);
            String inbox = AP.str(toActorObj, AP.inbox);

            /* lazy create fromActor here */
            if (fromActor == null) {
                fromActor = apUtil.makeActorUrlForUserName(fromUser);
            }

            APObj message = apFactory.newCreateMessageForNote(toUserNames, fromActor, inReplyTo, content, noteUrl, privateMessage,
                    attachments);

            apUtil.securePost(session, null, inbox, fromActor, message);
        }
    }

    /**
     * Gets the local account SubNode representing foreign user apUserName (like
     * someuser@fosstodon.org), by first checking the 'acctNodesByUserName' cache, or else by reading in
     * the user from the Fediverse, and updating the cache.
     */
    public SubNode getAcctNodeByUserName(MongoSession session, String apUserName) {
        if (!apUserName.contains("@")) {
            log.debug("Invalid foreign user name: " + apUserName);
            return null;
        }

        // return from cache if we already have the value cached
        SubNode acctNode = apCache.acctNodesByUserName.get(apUserName);
        if (acctNode != null) {
            return acctNode;
        }

        /* First try to get a cached APObj */
        APObj actor = apCache.actorsByUserName.get(apUserName);

        // if we have actor object skip the step of getting it and import using it.
        if (actor != null) {
            acctNode = importActor(session, actor);
        }

        /*
         * if we were unable to get the acctNode, then we need to read it from scratch meaning starting at
         * the very beginning which is to get webFinger first and load from there
         */
        if (acctNode == null) {
            log.debug("Load foreign user: " + apUserName);
            APObj webFinger = apUtil.getWebFinger(apUserName);

            String actorUrl = apUtil.getActorUrlFromWebFingerObj(webFinger);
            if (actorUrl != null) {
                acctNode = getAcctNodeByActorUrl(session, actorUrl);
            }
        }

        // if we got the SubNode, cache it before returning it.
        if (acctNode != null) {
            // Any time we have an account node being cached we should cache it by it's ID too right away.
            apCache.acctNodesById.put(acctNode.getId().toHexString(), acctNode);
            apCache.acctNodesByUserName.put(apUserName, acctNode);
        }
        return acctNode;
    }

    /**
     * Gets foreign account SubNode using actorUrl, using the cached copy of found.
     */
    public SubNode getAcctNodeByActorUrl(MongoSession session, String actorUrl) {
        /* return node from cache if already cached */
        SubNode acctNode = apCache.acctNodesByActorUrl.get(actorUrl);
        if (acctNode != null) {
            return acctNode;
        }

        APObj actor = apUtil.getActorByUrl(actorUrl);

        // if webfinger was successful, ensure the user is imported into our system.
        if (actor != null) {
            acctNode = importActor(session, actor);
            if (acctNode != null) {
                // Any time we have an account node being cached we should cache it by it's ID too right away.
                apCache.acctNodesById.put(acctNode.getId().toHexString(), acctNode);
                apCache.acctNodesByActorUrl.put(actorUrl, acctNode);
            }
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
        // log.debug("importing Actor: " + apUserName);

        // Try to get the userNode for this actor
        SubNode userNode = read.getUserNodeByUserName(session, apUserName);

        /*
         * If we don't have this user in our system, create them.
         */
        if (userNode == null) {
            userNode = util.createUser(session, apUserName, null, null, true);
        }

        boolean changed = false;
        Object icon = AP.obj(actor, AP.icon);
        if (icon != null) {
            String iconUrl = AP.str(icon, AP.url);
            if (iconUrl != null) {
                String curIconUrl = userNode.getStrProp(NodeProp.ACT_PUB_USER_ICON_URL.s());
                if (!iconUrl.equals(curIconUrl)) {
                    if (userNode.setProp(NodeProp.ACT_PUB_USER_ICON_URL.s(), iconUrl)) {
                        changed = true;
                    }
                }
            }
        }

        if (userNode.setProp(NodeProp.USER_BIO.s(), AP.str(actor, AP.summary)))
            changed = true;
        if (userNode.setProp(NodeProp.ACT_PUB_ACTOR_ID.s(), AP.str(actor, AP.id)))
            changed = true;
        if (userNode.setProp(NodeProp.ACT_PUB_ACTOR_INBOX.s(), AP.str(actor, AP.inbox)))
            changed = true;
        if (userNode.setProp(NodeProp.ACT_PUB_ACTOR_URL.s(), AP.str(actor, AP.url)))
            changed = true;

        if (changed) {
            update.save(session, userNode, false);
        }

        /* cache the account node id for this user by the actor url */
        String selfRef = AP.str(actor, AP.id); // actor url of 'actor' object, is the same as the 'id'
        apCache.acctIdByActorUrl.put(selfRef, userNode.getId().toHexString());
        return userNode;
    }

    /*
     * Processes incoming INBOX requests for (Follow, Undo Follow), to be called by foreign servers to
     * follow a user on this server
     */
    public APObj processInboxPost(HttpServletRequest httpReq, Object payload) {
        String type = AP.str(payload, AP.type);

        // switch statement here? (todo-0)

        // Process Create Action
        if (APType.Create.equalsIgnoreCase(type)) {
            return processCreateAction(httpReq, payload);
        }
        // Process Follow Action
        else if (APType.Follow.equalsIgnoreCase(type)) {
            return apFollowing.processFollowAction(payload, false);
        }
        // Process Undo Action (Unfollow, etc)
        else if (APType.Undo.equalsIgnoreCase(type)) {
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
        Object object = AP.obj(payload, AP.object);
        if (object != null && APType.Follow.equalsIgnoreCase(AP.str(object, AP.type))) {
            return apFollowing.processFollowAction(object, true);
        }
        return null;
    }

    public APObj processCreateAction(HttpServletRequest httpReq, Object payload) {
        APObj _ret = (APObj) adminRunner.run(session -> {

            String actorUrl = AP.str(payload, AP.actor);
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

            Object object = AP.obj(payload, AP.object);
            if (object != null && APType.Note.equalsIgnoreCase(AP.str(object, AP.type))) {
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
        String inReplyTo = AP.str(obj, AP.inReplyTo);

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
            SubNode actorAccountNode = getAcctNodeByActorUrl(session, actorUrl);
            if (actorAccountNode != null) {
                String userName = actorAccountNode.getStrProp(NodeProp.USER.s());
                SubNode postsNode = read.getUserNodeByType(session, userName, actorAccountNode, "### Posts",
                        NodeType.ACT_PUB_POSTS.s(), null);
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
        String id = AP.str(obj, AP.id);

        /*
         * First look to see if there is a target node already existing for this so we don't add a duplicate
         */
        SubNode dupNode = read.findSubNodeByProp(session, parentNode.getPath(), NodeProp.ACT_PUB_ID.s(), id);
        if (dupNode != null) {
            // log.debug("duplicate ActivityPub post ignored: " + id);
            return;
        }

        Date published = AP.date(obj, AP.published);
        String inReplyTo = AP.str(obj, AP.inReplyTo);
        String contentHtml = AP.str(obj, AP.content);
        String objUrl = AP.str(obj, AP.url);
        String objAttributedTo = AP.str(obj, AP.attributedTo);
        String objType = AP.str(obj, AP.type);
        Boolean sensitive = AP.bool(obj, AP.sensitive);

        // Ignore non-english for now (later we can make this a user-defined language selection)
        String lang = "0";
        Object context = AP.obj(obj, AP.context);
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
                    // this was an arbitrary meaningless value used to detect/test for correct program flow.
                    lang = "en-ck3";
                }
            }
        }

        // foreign account will own this node, this may be passed if it's known or null can be passed in.
        if (toAccountNode == null) {
            toAccountNode = getAcctNodeByActorUrl(session, objAttributedTo);
        }
        SubNode newNode = create.createNode(session, parentNode, null, null, 0L, CreateNodeLocation.FIRST, null,
                toAccountNode.getId(), true);

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

        shareToAllObjectRecipients(session, newNode, obj, AP.to);
        shareToAllObjectRecipients(session, newNode, obj, AP.cc);

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
                // todo-0: Everywhere we create a MediaType, replace it with a pre-created one on Constants
                APObj followersObj = apUtil.getJson(url, APConst.MT_APP_ACTJSON);
                if (followersObj != null) {
                    apUtil.iterateOrderedCollection(followersObj, MAX_FOLLOWERS, obj -> {
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
        String acctId = apCache.acctIdByActorUrl.get(actorUrl);

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
                 * todo-1: this is contributing to our [currently] unwanted CRAWLER effect (FediCrawler!) chain reaction. The
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
        List<?> attachments = AP.list(obj, AP.attachment);
        if (attachments == null)
            return;

        for (Object att : attachments) {
            String mediaType = AP.str(att, AP.mediaType);
            String url = AP.str(att, AP.url);

            if (mediaType != null && url != null) {
                attachmentService.readFromUrl(session, url, node.getId().toHexString(), mediaType, -1, false);

                // for now we only support one attachment so break out after uploading one.
                break;
            }
        }
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
                actor.put(AP.context, new APList() //
                        .val(APConst.CONTEXT_STREAMS) //
                        .val(APConst.CONTEXT_SECURITY));

                /*
                 * Note: this is a self-reference, and must be identical to the URL that returns this object
                 */
                actor.put(AP.id, apUtil.makeActorUrlForUserName(userName));
                actor.put(AP.type, APType.Person);
                actor.put(AP.preferredUsername, userName);
                actor.put(AP.name, userName); // this should be ordinary name (first last)

                actor.put(AP.icon, new APObj() //
                        .put(AP.type, APType.Image) //
                        .put(AP.mediaType, avatarMime) //
                        .put(AP.url, avatarUrl));

                String headerImageMime = userNode.getStrProp(NodeProp.BIN_MIME.s() + "Header");
                if (headerImageMime != null) {
                    String headerImageVer = userNode.getStrProp(NodeProp.BIN.s() + "Header");
                    if (headerImageVer != null) {
                        String headerImageUrl = appProp.getProtocolHostAndPort() + AppController.API_PATH + "/bin/profileHeader"
                                + "?nodeId=" + userNode.getId().toHexString() + "&v=" + headerImageVer;

                        actor.put(AP.image, new APObj() //
                                .put(AP.type, APType.Image) //
                                .put(AP.mediaType, headerImageMime) //
                                .put(AP.url, headerImageUrl));
                    }
                }

                actor.put(AP.summary, userNode.getStrProp(NodeProp.USER_BIO.s()));
                actor.put(AP.inbox, host + APConst.PATH_INBOX + "/" + userName); //
                actor.put(AP.outbox, host + APConst.PATH_OUTBOX + "/" + userName); //
                actor.put(AP.followers, host + APConst.PATH_FOLLOWERS + "/" + userName);
                actor.put(AP.following, host + APConst.PATH_FOLLOWING + "/" + userName);

                /*
                 * Note: Mastodon requests the wrong url when it needs this but we compansate with a redirect to tis
                 * in our ActPubController. We tolerate Mastodon breaking spec here.
                 */
                actor.put(AP.url, host + "/u/" + userName + "/home");

                actor.put(AP.endpoints, new APObj().put(AP.sharedInbox, host + APConst.PATH_INBOX));

                actor.put(AP.publicKey, new APObj() //
                        .put(AP.id, AP.str(actor, AP.id) + "#main-key") //
                        .put(AP.owner, AP.str(actor, AP.id)) //
                        .put(AP.publicKeyPem, "-----BEGIN PUBLIC KEY-----\n" + publicKey + "\n-----END PUBLIC KEY-----\n"));

                actor.put(AP.supportsFriendRequests, true);

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
                        apFollowing.setFollowing(friendUserName, false);
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
        if (!appProp.isActPubEnabled()) {
            return;
        }

        if (apUserName == null || !apUserName.contains("@") || apUserName.toLowerCase().endsWith("@" + appProp.getMetaHost()))
            return;

        // unless force is true, don't add this apUserName to pending list
        if (!force && apCache.usersPendingRefresh.contains(apUserName)) {
            return;
        }

        // add as 'false' meaning the refresh is not yet done
        apCache.usersPendingRefresh.put(apUserName, false);
    }

    /* every 30 minutes ping all the outboxes */
    @Scheduled(fixedDelay = 30 * DateUtil.MINUTE_MILLIS)
    public void bigRefresh() {
        refreshForeignUsers();
    }

    /* Run every few seconds */
    @Scheduled(fixedDelay = 3 * 1000)
    public void messageRefresh() {
        if (!appProp.isActPubEnabled())
            return;

        try {
            for (String apUserName : apCache.usersPendingRefresh.keySet()) {
                Boolean done = apCache.usersPendingRefresh.get(apUserName);
                if (done)
                    continue;

                // flag as done.
                apCache.usersPendingRefresh.put(apUserName, true);

                final String _apUserName = apUserName;
                adminRunner.run(session -> {
                    // log.debug("Reload user outbox: " + _apUserName);
                    SubNode userNode = getAcctNodeByUserName(session, _apUserName);
                    if (userNode == null)
                        return null;

                    String actorUrl = userNode.getStrProp(NodeProp.ACT_PUB_ACTOR_URL.s());
                    APObj actor = apUtil.getActorByUrl(actorUrl);
                    if (actor != null) {
                        apOutbox.refreshOutboxFromForeignServer(session, actor, userNode, _apUserName);
                    } else {
                        log.debug("Unable to get cached actor from url: " + actorUrl);
                    }

                    return null;
                });
            }
        } catch (Exception e) {
            // log and ignore.
            log.error("messageRefreshFailed", e);
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
        if (!appProp.isActPubEnabled())
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

    public String getStatsReport() {
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
