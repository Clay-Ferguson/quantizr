package quanta.actpub;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.security.PublicKey;
import java.util.Arrays;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.concurrent.Executor;
import javax.servlet.http.HttpServletRequest;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import quanta.AppController;
import quanta.actpub.model.AP;
import quanta.actpub.model.APList;
import quanta.actpub.model.APObj;
import quanta.actpub.model.APType;
import quanta.config.AppProp;
import quanta.config.NodeName;
import quanta.config.NodePath;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.model.client.PrincipalName;
import quanta.model.client.PrivilegeType;
import quanta.mongo.AdminRun;
import quanta.mongo.CreateNodeLocation;
import quanta.mongo.MongoAuth;
import quanta.mongo.MongoCreate;
import quanta.mongo.MongoDelete;
import quanta.mongo.MongoRead;
import quanta.mongo.MongoRepository;
import quanta.mongo.MongoSession;
import quanta.mongo.MongoUpdate;
import quanta.mongo.MongoUtil;
import quanta.mongo.model.AccessControl;
import quanta.mongo.model.FediverseName;
import quanta.mongo.model.SubNode;
import quanta.service.AclService;
import quanta.service.AttachmentService;
import quanta.service.NodeSearchService;
import quanta.service.PushService;
import quanta.service.UserManagerService;
import quanta.util.AsyncExec;
import quanta.util.DateUtil;
import quanta.util.EnglishDictionary;
import quanta.util.ThreadLocals;
import quanta.util.XString;

/**
 * General AP functions
 */
@Lazy
@Component
public class ActPubService {
    private static final Logger log = LoggerFactory.getLogger(ActPubService.class);

    @Autowired
    @Lazy
    protected MongoTemplate ops;

    @Autowired
    @Lazy
    protected EnglishDictionary english;

    @Autowired
    @Lazy
    protected PushService push;

    @Autowired
    @Lazy
    protected ActPubFactory apFactory;

    @Autowired
    @Lazy
    protected ActPubCrypto apCrypto;

    @Autowired
    @Lazy
    public ActPubCache apCache;

    @Autowired
    @Lazy
    protected ActPubUtil apUtil;

    @Autowired
    @Lazy
    protected ActPubOutbox apOutbox;

    @Autowired
    @Lazy
    protected ActPubFollower apFollower;

    @Autowired
    @Lazy
    protected ActPubFollowing apFollowing;

    @Autowired
    @Lazy
    protected AsyncExec asyncExec;

    @Autowired
    @Lazy
    protected AttachmentService attach;

    @Autowired
    @Lazy
    protected AdminRun arun;

    @Autowired
    @Lazy
    protected AppProp prop;

    @Autowired
    @Lazy
    protected UserManagerService user;

    @Autowired
    @Lazy
    protected AclService acl;

    @Autowired
    @Lazy
    protected MongoUtil mongoUtil;

    @Autowired
    @Lazy
    protected MongoAuth auth;

    @Autowired
    @Lazy
    protected MongoDelete delete;

    @Autowired
    @Lazy
    protected MongoUpdate update;

    @Autowired
    @Lazy
    protected MongoRead read;

    @Autowired
    @Lazy
    protected MongoCreate create;

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

    @Autowired
    @Qualifier("threadPoolTaskExecutor")
    private Executor executor;

    private static final Object inboxLock = new Object();

    /*
     * When 'node' has been created under 'parent' (by the sessionContext user) this will send a
     * notification to foreign servers. This call returns immediately and delegates the actuall
     * proccessing to a daemon thread.
     * 
     * For concurrency reasons, note that we pass in the nodeId to this method rather than the node even
     * if we do have the node, becuase we want to make sure there's no concurrent access.
     */
    public void sendNotificationForNodeEdit(MongoSession ms, String inReplyTo, HashMap<String, AccessControl> acl,
            APList attachments, String content, String noteUrl) {
        asyncExec.run(ThreadLocals.getContext(), () -> {
            try {
                List<String> toUserNames = new LinkedList<>();
                boolean privateMessage = true;

                /*
                 * Now we need to lookup all userNames from the ACL info, to add them all to 'toUserNames', and we
                 * can avoid doing any work for the ones in 'toUserNamesSet', because we know they already are taken
                 * care of (in the list)
                 */
                for (String k : acl.keySet()) {
                    if (PrincipalName.PUBLIC.s().equals(k)) {
                        privateMessage = false;
                    } else {
                        // k will be a nodeId of an account node here.
                        SubNode accntNode = apCache.acctNodesById.get(k);

                        if (no(accntNode)) {
                            accntNode = read.getNode(ms, k);
                            apCache.acctNodesById.put(k, accntNode);
                        }

                        if (ok(accntNode)) {
                            String userName = accntNode.getStr(NodeProp.USER.s());
                            toUserNames.add(userName);
                        }
                    }
                }

                // String apId = parent.getStringProp(NodeProp.ACT_PUB_ID.s());
                String fromUser = ThreadLocals.getSC().getUserName();
                String fromActor = apUtil.makeActorUrlForUserName(fromUser);

                // When posting a public message we send out to all unique sharedInboxes here
                if (!privateMessage) {
                    HashSet<String> sharedInboxes = getSharedInboxesOfFollowers(fromUser);

                    if (sharedInboxes.size() > 0) {
                        APObj message = apFactory.newCreateMessageForNote(toUserNames, fromActor, inReplyTo, content, noteUrl,
                                privateMessage, attachments);

                        for (String inbox : sharedInboxes) {
                            apUtil.securePost(fromUser, ms, null, inbox, fromActor, message, null);
                        }
                    }
                }

                if (toUserNames.size() > 0) {
                    sendNote(ms, toUserNames, fromUser, inReplyTo, content, attachments, noteUrl, privateMessage);
                }
            } //
            catch (Exception e) {
                log.error("sendNote failed", e);
                throw new RuntimeException(e);
            }
        });
    }

    /*
     * Finds all the foreign server followers of userName, and returns the unique set of sharedInboxes
     * of them all
     */
    public HashSet<String> getSharedInboxesOfFollowers(String userName) {
        HashSet<String> set = new HashSet<>();
        MongoSession as = auth.getAdminSession();

        // This query gets the FRIEND nodes that specifify userName on them
        Query query = apFollower.getFriendsByUserName_query(as, userName);
        if (no(query))
            return null;

        Iterable<SubNode> iterable = mongoUtil.find(query);

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
                        set.add(sharedInbox);
                    }
                }
            }
        }
        return set;
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
                            .put(APObj.url, prop.getProtocolHostAndPort() + "/f/id/" + node.getIdStr()));
        }
        return attachments;
    }

    /* Sends note outbound to other servers */
    public void sendNote(MongoSession ms, List<String> toUserNames, String fromUser, String inReplyTo, String content,
            APList attachments, String noteUrl, boolean privateMessage) {
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

            // Ignore userNames that are for our own host
            String userHost = apUtil.getHostFromUserName(toUserName);
            if (userHost.equals(host)) {
                continue;
            }

            APObj webFinger = apUtil.getWebFinger(toUserName);
            if (no(webFinger)) {
                apUtil.log("Unable to get webfinger for " + toUserName);
                continue;
            }

            String toActorUrl = apUtil.getActorUrlFromWebFingerObj(webFinger);
            APObj toActorObj = apUtil.getActorByUrl(toActorUrl);
            if (ok(toActorObj)) {
                String inbox = AP.str(toActorObj, APObj.inbox);

                /* lazy create fromActor here */
                if (no(fromActor)) {
                    fromActor = apUtil.makeActorUrlForUserName(fromUser);
                }

                APObj message = apFactory.newCreateMessageForNote(toUserNames, fromActor, inReplyTo, content, noteUrl,
                        privateMessage, attachments);

                String userDoingPost = ThreadLocals.getSC().getUserName();
                apUtil.securePost(userDoingPost, ms, null, inbox, fromActor, message, null);
            }
        }
    }

    /**
     * Gets the account SubNode representing foreign user apUserName (like someuser@fosstodon.org), by
     * first checking the 'acctNodesByUserName' cache, or else by reading in the user from the
     * Fediverse, and updating the cache.
     */
    public SubNode getAcctNodeByUserName(MongoSession ms, String apUserName) {
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

        // todo-1: if we ALWAYS read from DB like this the data (Actor props) can get stale over time (solve
        // this)
        // (to not have the 'stale issue', let's just not read from DB ever right here)
        // acctNode = read.getUserNodeByUserName(ms, apUserName);

        // if (no(acctNode )) {
        /* First try to get a cached actor APObj */
        APObj actor = apCache.actorsByUserName.get(apUserName);

        // if we have actor object skip the step of getting it and import using it.
        if (ok(actor)) {
            acctNode = importActor(ms, null, actor);
        }
        // }

        /*
         * if we were unable to get the acctNode, then we need to read it from scratch meaning starting at
         * the very beginning which is to get webFinger first and load from there
         */
        if (no(acctNode)) {
            log.debug("Loading foreign user: " + apUserName);
            APObj webFinger = apUtil.getWebFinger(apUserName);

            if (ok(webFinger)) {
                String actorUrl = apUtil.getActorUrlFromWebFingerObj(webFinger);
                if (ok(actorUrl)) {
                    acctNode = getAcctNodeByActorUrl(ms, actorUrl);
                }
            }
        }

        // if we got the SubNode, cache it before returning it.
        if (ok(acctNode)) {
            // Any time we have an account node being cached we should cache it by it's ID too right away.
            apCache.acctNodesById.put(acctNode.getIdStr(), acctNode);
            apCache.acctNodesByUserName.put(apUserName, acctNode);
        } else {
            log.error("Unable to load user: " + apUserName);
        }
        return acctNode;
    }

    /**
     * Gets foreign account SubNode using actorUrl, using the cached copy of found.
     */
    public SubNode getAcctNodeByActorUrl(MongoSession ms, String actorUrl) {
        saveFediverseName(actorUrl);

        /* return node from cache if already cached */
        SubNode acctNode = apCache.acctNodesByActorUrl.get(actorUrl);
        if (ok(acctNode)) {
            return acctNode;
        }

        APObj actor = apUtil.getActorByUrl(actorUrl);

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
    public SubNode importActor(MongoSession ms, SubNode userNode, Object actor) {

        // if userNode unknown then get and/or create one. May be creating a brand new one even.
        if (no(userNode)) {
            String apUserName = apUtil.getLongUserNameFromActor(actor);

            apUserName = apUserName.trim();

            // This checks for both the non-port and has-port versions of the host (host may or may not have
            // port)
            if (apUserName.endsWith("@" + prop.getMetaHost().toLowerCase())
                    || apUserName.contains("@" + prop.getMetaHost().toLowerCase() + ":")) {
                log.debug("Can't import a user that's not from a foreign server.");
                return null;
            }
            apUtil.log("importing Actor: " + apUserName);

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
        Object icon = AP.obj(actor, APObj.icon);
        if (ok(icon)) {
            String iconUrl = AP.str(icon, APObj.url);
            if (ok(iconUrl)) {
                String curIconUrl = userNode.getStr(NodeProp.ACT_PUB_USER_ICON_URL.s());
                if (!iconUrl.equals(curIconUrl)) {
                    if (userNode.set(NodeProp.ACT_PUB_USER_ICON_URL.s(), iconUrl)) {
                        changed = true;
                    }
                }
            }
        }

        Object endpoints = AP.obj(actor, APObj.endpoints);
        if (ok(endpoints)) {
            String sharedInbox = AP.str(endpoints, APObj.sharedInbox);
            if (ok(sharedInbox)) {
                String curSharedInbox = userNode.getStr(NodeProp.ACT_PUB_SHARED_INBOX.s());
                if (!sharedInbox.equals(curSharedInbox)) {
                    if (userNode.set(NodeProp.ACT_PUB_SHARED_INBOX.s(), sharedInbox)) {
                        changed = true;
                    }
                }
            }
        }

        Object image = AP.obj(actor, APObj.image);
        if (ok(image)) {
            String imageUrl = AP.str(image, APObj.url);
            if (ok(imageUrl)) {
                String curImageUrl = userNode.getStr(NodeProp.ACT_PUB_USER_IMAGE_URL.s());
                if (!imageUrl.equals(curImageUrl)) {
                    if (userNode.set(NodeProp.ACT_PUB_USER_IMAGE_URL.s(), imageUrl)) {
                        changed = true;
                    }
                }
            }
        }

        if (userNode.set(NodeProp.USER_BIO.s(), AP.str(actor, APObj.summary)))
            changed = true;

        if (userNode.set(NodeProp.DISPLAY_NAME.s(), AP.str(actor, APObj.name)))
            changed = true;

        // this is the URL of the Actor JSON object
        if (userNode.set(NodeProp.ACT_PUB_ACTOR_ID.s(), AP.str(actor, APObj.id)))
            changed = true;

        if (userNode.set(NodeProp.ACT_PUB_ACTOR_INBOX.s(), AP.str(actor, APObj.inbox)))
            changed = true;

        // this is the URL of the HTML of the actor.
        if (userNode.set(NodeProp.ACT_PUB_ACTOR_URL.s(), AP.str(actor, APObj.url)))
            changed = true;

        if (changed) {
            update.save(ms, userNode, false);
        }

        /* cache the account node id for this user by the actor url */
        String selfRef = AP.str(actor, APObj.id); // actor url of 'actor' object, is the same as the 'id'
        apCache.acctIdByActorUrl.put(selfRef, userNode.getIdStr());
        return userNode;
    }

    /*
     * Processes incoming INBOX requests for (Follow, Undo Follow), to be called by foreign servers to
     * follow a user on this server
     */
    public void processInboxPost(HttpServletRequest httpReq, Object payload) {
        // todo-1: for now we mutext the inbox becasue I noticed a scenario where Mastodon post TWO
        // simultaneous calls for the SAME node, and we shouldn't allow that.
        synchronized (inboxLock) {
            String type = AP.str(payload, APObj.type);
            if (no(type))
                return;
            type = type.trim();
            apUtil.log("inbox type: " + type);

            switch (type) {
                case APType.Create:
                    processCreateAction(httpReq, payload);
                    break;

                case APType.Follow:
                    apFollowing.processFollowAction(payload, false);
                    break;

                case APType.Undo:
                    processUndoAction(payload);
                    break;

                case APType.Delete:
                    processDeleteAction(httpReq, payload);
                    break;

                default:
                    log.debug("Unsupported type:" + XString.prettyPrint(payload));
                    break;
            }
        }
    }

    /* Process inbound undo actions (coming from foreign servers) */
    public void processUndoAction(Object payload) {
        Object obj = AP.obj(payload, APObj.object);
        String type = AP.str(obj, APObj.type);
        apUtil.log("Undo Type: " + type);
        switch (type) {
            case APType.Follow:
                apFollowing.processFollowAction(obj, true);
                break;

            default:
                log.debug("Unsupported payload object type:" + XString.prettyPrint(obj));
                break;
        }
    }

    public void processCreateAction(HttpServletRequest httpReq, Object payload) {
        arun.<Object>run(session -> {
            apUtil.log("processCreateAction");
            String actorUrl = AP.str(payload, APObj.actor);
            if (no(actorUrl)) {
                log.debug("no 'actor' found on create action request posted object");
                return null;
            }

            APObj actorObj = apUtil.getActorByUrl(actorUrl);
            if (no(actorObj)) {
                log.debug("Unable to load actorUrl: " + actorUrl);
                return null;
            }

            PublicKey pubKey = apCrypto.getPublicKeyFromActor(actorObj);
            apCrypto.verifySignature(httpReq, pubKey);

            Object object = AP.obj(payload, APObj.object);
            String type = AP.str(object, APObj.type);
            apUtil.log("create type: " + type);

            switch (type) {
                case APType.Note:
                    processCreateNote(session, actorUrl, actorObj, object);
                    break;

                default:
                    // this captures videos? and other things (todo-1: add more support)
                    log.debug("Unhandled Create action");
                    break;
            }
            return null;
        });
    }

    public void processDeleteAction(HttpServletRequest httpReq, Object payload) {
        arun.<Object>run(session -> {
            apUtil.log("processDeleteAction");
            String actorUrl = AP.str(payload, APObj.actor);
            if (no(actorUrl)) {
                log.debug("no 'actor' found on create action request posted object");
                return null;
            }

            APObj actorObj = apUtil.getActorByUrl(actorUrl);
            if (no(actorObj)) {
                log.debug("Unable to load actorUrl: " + actorUrl);
                return null;
            }

            PublicKey pubKey = apCrypto.getPublicKeyFromActor(actorObj);
            apCrypto.verifySignature(httpReq, pubKey);

            Object object = AP.obj(payload, APObj.object);
            String type = AP.str(object, APObj.type);
            if (no(type)) {
                log.error("No delete type specified in delete request: " + XString.prettyPrint(payload));
                return null;
            }
            apUtil.log("delete type: " + type);

            switch (type) {
                case APType.Tombstone:
                    processCreateTombstone(session, actorUrl, actorObj, object);
                    break;

                default:
                    // this captures videos? and other things (todo-1: add more support)
                    log.debug("Unhandled Create action");
                    break;
            }
            return null;
        });
    }

    public void processCreateTombstone(MongoSession ms, String actorUrl, Object actorObj, Object obj) {
        apUtil.log("processCreateTombstone");
        String id = AP.str(obj, APObj.id);
        delete.deleteBySubNodePropVal(NodeProp.ACT_PUB_ID.s(), id);
    }

    /* obj is the 'Note' object */
    public void processCreateNote(MongoSession ms, String actorUrl, Object actorObj, Object obj) {
        apUtil.log("processCreateNote");
        /*
         * If this is a 'reply' post then parse the ID out of this, and if we can find that node by that id
         * then insert the reply under that, instead of the default without this id which is to put in
         * 'inbox'
         */
        String inReplyTo = AP.str(obj, APObj.inReplyTo);

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
                nodeBeingRepliedTo = read.getNode(ms, replyToId, false);
            }
        }

        /*
         * If a foreign user is replying to a specific node, we put the reply under that node
         */
        if (ok(nodeBeingRepliedTo)) {
            apUtil.log("foreign actor replying to a quanta node.");
            saveNote(ms, null, nodeBeingRepliedTo, obj, false, false);
        }
        /*
         * Otherwise the node is not a reply so we put it under POSTS node inside the foreign account node
         * on our server, and then we add 'sharing' to it for each person in the 'to/cc' so that this new
         * node will show up in those people's FEEDs
         */
        else {
            apUtil.log("not reply to existing Quanta node.");
            SubNode actorAccountNode = getAcctNodeByActorUrl(ms, actorUrl);
            if (ok(actorAccountNode)) {
                String userName = actorAccountNode.getStr(NodeProp.USER.s());
                SubNode postsNode = read.getUserNodeByType(ms, userName, actorAccountNode, "### Posts",
                        NodeType.ACT_PUB_POSTS.s(), Arrays.asList(PrivilegeType.READ.s()), NodeName.POSTS);
                saveNote(ms, actorAccountNode, postsNode, obj, false, false);
            }
        }
    }

    /*
     * Saves inbound note comming from other foreign servers
     * 
     * todo-1: when importing users in bulk (like at startup or the admin menu), some of these queries
     * in here will be redundant. Look for ways to optimize.
     * 
     * temp = true, means we are loading an outbox of a user and not recieving a message specifically to
     * a local user so the node should be considered 'temporary' and can be deleted after a week or so
     * to clean the Db.
     */
    public void saveNote(MongoSession ms, SubNode toAccountNode, SubNode parentNode, Object obj, boolean forcePublic,
            boolean temp) {
        apUtil.log("saveNote");
        String id = AP.str(obj, APObj.id);

        /*
         * First look to see if there is a target node already existing for this so we don't add a duplicate
         */
        SubNode dupNode = read.findNodeByProp(ms, parentNode.getPath(), NodeProp.ACT_PUB_ID.s(), id);
        if (ok(dupNode)) {
            // apUtil.log("duplicate ActivityPub post ignored: " + id);
            return;
        }

        Date published = AP.date(obj, APObj.published);
        String inReplyTo = AP.str(obj, APObj.inReplyTo);
        String contentHtml = AP.str(obj, APObj.content);
        String objUrl = AP.str(obj, APObj.url);
        String objAttributedTo = AP.str(obj, APObj.attributedTo);
        String objType = AP.str(obj, APObj.type);
        Boolean sensitive = AP.bool(obj, APObj.sensitive);

        // Ignore non-english for now (later we can make this a user-defined language selection)
        String lang = "0";
        Object context = AP.obj(obj, APObj.context);
        if (ok(context)) {
            String language = AP.str(context, "@language");
            if (ok(language)) {
                lang = language;
                if (!"en".equalsIgnoreCase(language)) {
                    log.debug("Ignoring Non-English");
                    return;
                }
            }
        }

        if (ENGLISH_LANGUAGE_CHECK) {
            if (lang.equals("0")) {
                if (!english.isEnglish(contentHtml)) {
                    log.debug("Ignored Foreign: " + XString.prettyPrint(obj));
                    return;
                } else {
                    // this was an arbitrary meaningless value used to detect/test for correct program flow.
                    lang = "en-ck3";
                }
            }
        }

        // foreign account will own this node, this may be passed if it's known or null can be passed in.
        if (no(toAccountNode)) {
            toAccountNode = getAcctNodeByActorUrl(ms, objAttributedTo);
        }
        SubNode newNode =
                create.createNode(ms, parentNode, null, null, 0L, CreateNodeLocation.FIRST, null, toAccountNode.getId(), true);

        apUtil.log("createNode");

        // todo-1: need a new node prop type that is just 'html' and tells us to render
        // content as raw html if set, or for now
        // we could be clever and just detect if it DOES have tags and does NOT have
        // '```'
        newNode.setContent(contentHtml);

        // todo-1: I haven't yet tested that mentions are parsable in any Mastodon text using this method
        // but we at least know other instances of Quanta will have these extractable this way.
        HashSet<String> mentionsSet = auth.parseMentions(contentHtml);
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

        // part of troubleshooting the non-english language detection
        // newNode.setProp("lang", lang);

        shareToAllObjectRecipients(ms, newNode, obj, APObj.to);
        shareToAllObjectRecipients(ms, newNode, obj, APObj.cc);

        if (forcePublic) {
            acl.addPrivilege(ms, newNode, PrincipalName.PUBLIC.s(),
                    Arrays.asList(PrivilegeType.READ.s(), PrivilegeType.WRITE.s()), null);
        }

        update.save(ms, newNode);
        addAttachmentIfExists(ms, newNode, obj);
        try {
            push.pushNodeUpdateToBrowsers(ms, null, newNode);
        } catch (Exception e) {
            log.error("pushNodeUpdateToBrowsers failed (ignoring error)", e);
        }
    }

    /*
     * Adds node sharing (ACL) entries for all recipients (i.e. propName==to | cc)
     * 
     * The node save is expected to be done external to this function after this function runs.
     */
    private void shareToAllObjectRecipients(MongoSession ms, SubNode node, Object obj, String propName) {
        List<?> list = AP.list(obj, propName);
        if (ok(list)) {
            /* Build up all the access controls */
            for (Object to : list) {
                if (to instanceof String) {
                    /* The spec allows either a 'followers' URL here or an 'actor' URL here */
                    shareToUsersForUrl(ms, node, (String) to);
                } else {
                    apUtil.log("to list entry not supported: " + to.getClass().getName());
                }
            }
        } else {
            apUtil.log("No addressing to " + propName);
        }
    }

    /*
     * Reads the object from 'url' to determine if it's a 'followers' URL or an 'actor' URL, and then
     * shares the node to either all the followers or the specific actor
     */
    private void shareToUsersForUrl(MongoSession ms, SubNode node, String url) {
        apUtil.log("shareToUsersForUrl: " + url);

        if (apUtil.isPublicAddressed(url)) {
            node.safeGetAc().put(PrincipalName.PUBLIC.s(), new AccessControl(null, PrivilegeType.READ.s()));
            return;
        }

        /*
         * if url does not contain "/followers" then the best first try is to assume it's an actor url and
         * try that first
         */
        if (!url.contains("/followers")) {
            shareNodeToActorByUrl(ms, node, url);
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
                APObj followersObj = apUtil.getJson(url, APConst.MTYPE_ACT_JSON);
                if (ok(followersObj)) {
                    // note/warning: the ActPubFollower.java class also has code to read followers.
                    apUtil.iterateOrderedCollection(followersObj, MAX_FOLLOWERS, obj -> {
                        /*
                         * Mastodon seems to have the followers items as strings, which are the actor urls of the followers.
                         */
                        if (obj instanceof String) {
                            String followerActorUrl = (String) obj;
                            shareNodeToActorByUrl(ms, node, followerActorUrl);
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
    private void shareNodeToActorByUrl(MongoSession ms, SubNode node, String actorUrl) {
        apUtil.log("Sharing node to actorUrl: " + actorUrl);
        /*
         * Yes we tolerate for this to execute with the 'public' designation in place of an actorUrl here
         */
        if (actorUrl.endsWith("#Public")) {
            node.safeGetAc().put(PrincipalName.PUBLIC.s(), new AccessControl(null, PrivilegeType.READ.s()));
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
                String longUserName = apUtil.getLongUserNameFromActorUrl(actorUrl);
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
            apUtil.log("node shared to UserNodeId: " + acctId);
            node.safeGetAc().put(acctId, new AccessControl(null, PrivilegeType.READ.s() + "," + PrivilegeType.WRITE.s()));
        } else {
            apUtil.log("not sharing to this user.");
        }
    }

    private void addAttachmentIfExists(MongoSession ms, SubNode node, Object obj) {
        List<?> attachments = AP.list(obj, APObj.attachment);
        if (no(attachments))
            return;

        for (Object att : attachments) {
            String mediaType = AP.str(att, APObj.mediaType);
            String url = AP.str(att, APObj.url);

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
                                .put(APObj.id, AP.str(actor, APObj.id) + "#main-key") //
                                .put(APObj.owner, AP.str(actor, APObj.id)) //
                                .put(APObj.publicKeyPem,
                                        "-----BEGIN PUBLIC KEY-----\n" + publicKey + "\n-----END PUBLIC KEY-----\n")) //

                        .put(APObj.supportsFriendRequests, true);

                apUtil.log("Reply with Actor: " + XString.prettyPrint(actor));
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
        arun.run(session -> {
            SubNode node = read.getNode(session, nodeId);
            if (ok(node) && node.getType().equals(NodeType.FRIEND.s())) {
                String friendUserName = node.getStr(NodeProp.USER.s());
                if (ok(friendUserName)) {
                    // if a foreign user, update thru ActivityPub
                    if (friendUserName.contains("@")) {
                        String followerUser = ThreadLocals.getSC().getUserName();
                        apFollowing.setFollowing(followerUser, friendUserName, false);
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

    /* every 90 minutes ping all the outboxes */
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
        for (String userName : apCache.usersPendingRefresh.keySet()) {
            if (!prop.isDaemonsEnabled())
                break;
            try {
                Boolean done = apCache.usersPendingRefresh.get(userName);
                if (done)
                    continue;

                /*
                 * This is killing performance of the app so let's throttle it way back. Not sure if it's Disk or
                 * network I/O that's the problem but either way let's not read these so fast
                 */
                Thread.sleep(5000);

                // flag as done (even if it fails we still want it flagged as done. no retries will be done).
                apCache.usersPendingRefresh.put(userName, true);

                loadForeignUser(userName);
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

            arun.run(session -> {
                // Query to pull all user accounts
                Iterable<SubNode> accountNodes =
                        read.findTypedNodesUnderPath(session, NodePath.ROOT_OF_ALL_USERS, NodeType.ACCOUNT.s());

                for (SubNode acctNode : accountNodes) {

                    // get userName, and skip over any that aren't foreign accounts
                    String userName = acctNode.getStr(NodeProp.USER.s());
                    if (no(userName) || !userName.contains("@"))
                        continue;

                    // log.debug("get webFinger: " + userName);
                    String url = acctNode.getStr(NodeProp.ACT_PUB_ACTOR_ID.s());

                    try {
                        if (ok(url)) {
                            APObj actor = apUtil.getJson(url, APConst.MTYPE_ACT_JSON);

                            if (ok(actor)) {
                                // we could double check userName, and bail if wrong, but this is not needed.
                                // String userName = getLongUserNameFromActor(actor);
                                apCache.actorsByUrl.put(url, actor);
                                apCache.actorsByUserName.put(userName, actor);

                                // since we're passing in the account node this importActor will basically just update the
                                // properties on it and save it.
                                importActor(session, acctNode, actor);
                                // log.debug("import ok");
                                accountsRefreshed++;
                            }
                        }
                    } catch (Exception e) {
                        // todo-1: eating this for now.
                        log.debug("Failed getting actor: " + url);
                    }
                }
                log.debug("Finished refreshActorPropsForAllUsers");
                return null;
            });
        };
        executor.execute(runnable);
    }

    public void loadForeignUser(String userName) {
        arun.run(session -> {
            apUtil.log("Reload user outbox: " + userName);
            SubNode userNode = getAcctNodeByUserName(session, userName);
            if (no(userNode)) {
                // log.debug("Unable to getAccount Node for userName: "+userName);
                return null;
            }

            String actorUrl = userNode.getStr(NodeProp.ACT_PUB_ACTOR_ID.s());
            APObj actor = apUtil.getActorByUrl(actorUrl);
            if (ok(actor)) {
                apOutbox.loadForeignOutbox(session, actor, userNode, userName);

                /*
                 * I was going to load followerCounts into userNode, but I decided to just query them live when
                 * needed on the UserPreferences dialog
                 */
                int followerCount = apFollower.loadRemoteFollowers(session, actor);
                int followingCount = apFollowing.loadRemoteFollowing(session, actor);
            } else {
                log.debug("Unable to get actor from url: " + actorUrl);
            }
            return null;
        });
    }

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

        arun.run(session -> {
            Iterable<SubNode> accountNodes =
                    read.findTypedNodesUnderPath(session, NodePath.ROOT_OF_ALL_USERS, NodeType.ACCOUNT.s());

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

        return arun.run(session -> {
            Iterable<SubNode> accountNodes =
                    read.findTypedNodesUnderPath(session, NodePath.ROOT_OF_ALL_USERS, NodeType.ACCOUNT.s());

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
                        userName = apUtil.getLongUserNameFromActorUrl(userName);
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

        return arun.run(session -> {
            long totalDelCount = 0;
            Iterable<SubNode> accountNodes =
                    read.findTypedNodesUnderPath(session, NodePath.ROOT_OF_ALL_USERS, NodeType.ACCOUNT.s());

            for (SubNode node : accountNodes) {
                String userName = node.getStr(NodeProp.USER.s());
                if (no(userName) || !userName.contains("@"))
                    continue;

                long delCount = delete.deleteOldActPubPosts(node, session);
                totalDelCount += delCount;
                log.debug("Foreign User: " + userName + ". Deleted " + delCount);
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
}
