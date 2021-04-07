package org.subnode.service;

import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.Date;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;
import java.util.concurrent.ConcurrentHashMap;
import javax.servlet.http.HttpServletRequest;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.lang3.StringUtils;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.subnode.AppController;
import org.subnode.actpub.AP;
import org.subnode.actpub.APList;
import org.subnode.actpub.APObj;
import org.subnode.actpub.ActPubConstants;
import org.subnode.actpub.ActPubFactory;
import org.subnode.actpub.ActPubObserver;
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
import org.subnode.util.Util;
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

    /*
     * Holds users for which messages need refreshing (false value) but sets value to 'true' once
     * completed
     */
    public static final ConcurrentHashMap<String, Boolean> userNamesPendingMessageRefresh =
            new ConcurrentHashMap<>();

    /* Cache Actor objects by URL in memory only for now */
    public static final ConcurrentHashMap<String, APObj> actorCacheByUrl = new ConcurrentHashMap<>();

    /* Cache Actor objects by UserName in memory only for now */
    private static final ConcurrentHashMap<String, APObj> actorCacheByUserName = new ConcurrentHashMap<>();

    /* Cache WebFinger objects by UserName in memory only for now */
    private static final ConcurrentHashMap<String, APObj> webFingerCacheByUserName = new ConcurrentHashMap<>();

    /* Cache of user account node Ids by actor url */
    private static final ConcurrentHashMap<String, String> acctIdByActorUrl = new ConcurrentHashMap<>();

    /* Account Node by actor Url */
    private static final ConcurrentHashMap<String, SubNode> accountNodesByActorUrl = new ConcurrentHashMap<>();

    /* Account Node by User Name */
    private static final ConcurrentHashMap<String, SubNode> accountNodesByUserName = new ConcurrentHashMap<>();

    /* Account Node by node ID */
    private static final ConcurrentHashMap<String, SubNode> accountNodesById = new ConcurrentHashMap<>();

    /*
     * RestTemplate is thread-safe and reusable, and has no state, so we need only one final static
     * instance ever
     */
    private static final RestTemplate restTemplate = new RestTemplate(Util.getClientHttpRequestFactory());
    private static final ObjectMapper mapper = new ObjectMapper();

    // NOTE: This didn't allow unknown properties as expected but putting the
    // following in the JSON classes did:
    // @JsonIgnoreProperties(ignoreUnknown = true)
    {
        mapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    }

    /* Gets private RSA key from current user session */
    private String getPrivateKey(MongoSession session, String userName) {
        /* First try to return the key from the cache */
        String privateKey = UserManagerService.privateKeysByUserName.get(userName);
        if (privateKey != null) {
            return privateKey;
        }

        /* get the userNode for the current user who edited a node */
        SubNode userNode = read.getUserNodeByUserName(session, userName);
        if (userNode == null) {
            return null;
        }

        /* get private key of this user so we can sign the outbound message */
        privateKey = userNode.getStrProp(NodeProp.CRYPTO_KEY_PRIVATE);
        if (privateKey == null) {
            log.debug("Unable to update federated users. Our local user didn't have a private key on his userNode: "
                    + ThreadLocals.getSessionContext().getUserName());
            return null;
        }

        // add to cache.
        UserManagerService.privateKeysByUserName.put(userName, privateKey);
        return privateKey;
    }

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

    public String makeActorUrlForUserName(String userName) {
        return appProp.getProtocolHostAndPort() + ActPubConstants.ACTOR_PATH + "/" + userName;
    }

    /* Builds the unique set of hosts from a list of userNames (not used currently) */
    public HashSet<String> getHostsFromUserNames(List<String> userNames) {
        String host = appProp.getMetaHost();
        HashSet<String> hosts = new HashSet<>();

        for (String toUserName : userNames) {

            // Ignore userNames that are not foreign server names
            if (!toUserName.contains("@")) {
                continue;
            }

            // Ignore userNames that are for our own host
            String userHost = getHostFromUserName(toUserName);
            if (userHost.equals(host)) {
                continue;
            }

            hosts.add(userHost);
        }
        return hosts;
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
            String userHost = getHostFromUserName(toUserName);
            if (userHost.equals(host)) {
                continue;
            }

            APObj webFinger = getWebFinger(toUserName);
            if (webFinger == null) {
                log.debug("Unable to get webfinger for " + toUserName);
                continue;
            }

            String toActorUrl = getActorUrlFromWebFingerObj(webFinger);
            Object toActorObj = getActorByUrl(toActorUrl);
            String inbox = AP.str(toActorObj, "inbox");

            /* lazy create fromActor here */
            if (fromActor == null) {
                fromActor = makeActorUrlForUserName(fromUser);
            }

            APObj message = apFactory.newCreateMessageForNote(toUserNames, fromActor, inReplyTo, content, noteUrl, privateMessage,
                    attachments);

            securePost(session, null, inbox, fromActor, message);
        }
    }

    /*
     * Note: 'actor' here is the actor URL of the local (non-federated) user doing the post
     */
    private void securePost(MongoSession session, String privateKey, String toInbox, String actor, APObj message) {
        try {
            /* if private key not sent then get it using the session */
            if (privateKey == null) {
                privateKey = getPrivateKey(session, ThreadLocals.getSessionContext().getUserName());
            }

            String body = XString.prettyPrint(message);
            byte[] bodyBytes = body.getBytes(StandardCharsets.UTF_8);
            log.debug("Posting to inbox " + toInbox + ":\n" + body);

            byte[] privKeyBytes = Base64.getDecoder().decode(privateKey);
            KeyFactory kf = KeyFactory.getInstance("RSA");
            PKCS8EncodedKeySpec keySpecPKCS8 = new PKCS8EncodedKeySpec(privKeyBytes);
            PrivateKey privKey = kf.generatePrivate(keySpecPKCS8);

            // import java.security.PublicKey;
            // import java.security.interfaces.RSAPublicKey;
            // import java.security.spec.X509EncodedKeySpec;
            // byte[] publicKeyBytes = Base64.getDecoder().decode(publicKey);
            // X509EncodedKeySpec keySpecX509 = new X509EncodedKeySpec(publicKeyBytes);
            // PUblicKey pubKey = (RSAPublicKey) kf.generatePublic(keySpecX509);

            SimpleDateFormat dateFormat = new SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss z", Locale.US);
            dateFormat.setTimeZone(TimeZone.getTimeZone("GMT"));
            String date = dateFormat.format(new Date());

            String digestHeader =
                    "SHA-256=" + Base64.getEncoder().encodeToString(MessageDigest.getInstance("SHA-256").digest(bodyBytes));

            URL url = new URL(toInbox);
            String host = url.getHost();
            String path = url.getPath();

            String strToSign =
                    "(request-target): post " + path + "\nhost: " + host + "\ndate: " + date + "\ndigest: " + digestHeader;

            Signature sig = Signature.getInstance("SHA256withRSA");
            sig.initSign(privKey);
            sig.update(strToSign.getBytes(StandardCharsets.UTF_8));
            byte[] signature = sig.sign();

            String keyID = actor + "#main-key";
            String headerSig = "keyId=\"" + keyID + "\",headers=\"(request-target) host date digest\",signature=\""
                    + Base64.getEncoder().encodeToString(signature) + "\"";

            postJson(toInbox, host, date, headerSig, digestHeader, bodyBytes);
        } catch (Exception e) {
            log.error("secure http post failed", e);
            throw new RuntimeException(e);
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
        APObj webFinger = getWebFinger(apUserName);

        String actorUrl = getActorUrlFromWebFingerObj(webFinger);
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

        Object actor = getActorByUrl(actorUrl);

        // if webfinger was successful, ensure the user is imported into our system.
        if (actor != null) {
            accountNodesByActorUrl.put(actorUrl, acctNode = importActor(session, actor));
        }
        return acctNode;
    }

    public String getActorUrlFromWebFingerObj(Object webFinger) {
        if (webFinger == null)
            return null;
        Object self = getLinkByRel(webFinger, "self");
        // log.debug("Self Link: " + XString.prettyPrint(self));

        String actorUrl = null;
        if (self != null) {
            actorUrl = AP.str(self, "href");
        }
        return actorUrl;
    }

    /*
     * Returns account node of the user, creating one if not already existing
     */
    public SubNode importActor(MongoSession session, Object actor) {

        String apUserName = getLongUserNameFromActor(actor);

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

    /*
     * input: clay@server.com
     * 
     * output: server.com
     */
    public String getHostFromUserName(String userName) {
        int atIdx = userName.indexOf("@");
        if (atIdx == -1)
            return null;
        return userName.substring(atIdx + 1);
    }

    /*
     * input: clay@server.com
     * 
     * output: clay
     */
    public String stripHostFromUserName(String userName) {
        int atIdx = userName.indexOf("@");
        if (atIdx == -1)
            return userName;
        return userName.substring(0, atIdx);
    }

    /*
     * https://server.org/.well-known/webfinger?resource=acct:someuser@server.org'
     * 
     * Get WebFinger from foreign server
     * 
     * resource example: someuser@server.org
     */
    public APObj getWebFinger(String resource) {
        if (resource.startsWith("@")) {
            resource = resource.substring(1);
        }
        String host = "https://" + getHostFromUserName(resource);

        // return from cache if we have this cached
        APObj finger = webFingerCacheByUserName.get(resource);
        if (finger != null) {
            return finger;
        }

        String url = host + ActPubConstants.PATH_WEBFINGER + "?resource=acct:" + resource;
        finger = getJson(url, new MediaType("application", "jrd+json"));

        if (finger != null) {
            // log.debug("Caching WebFinger: " + XString.prettyPrint(finger));
            webFingerCacheByUserName.put(resource, finger);
        }
        return finger;
    }

    /*
     * Effeciently gets the Actor by using a cache to ensure we never get the same Actor twice until the
     * app restarts at least
     */
    public APObj getActorByUrl(String url) {
        if (url == null)
            return null;

        APObj actor = actorCacheByUrl.get(url);
        if (actor != null) {
            return actor;
        }

        actor = getJson(url, new MediaType("application", "ld+json"));
        cacheActor(url, actor);

        // log.debug("Actor: " + XString.prettyPrint(actor));
        return actor;
    }

    public void cacheActor(String url, APObj actor) {
        if (actor != null) {
            actorCacheByUrl.put(url, actor);

            String userName = getLongUserNameFromActor(actor);
            actorCacheByUserName.put(userName, actor);
        }
    }

    public APObj getOutbox(String url) {
        if (url == null)
            return null;
        APObj outbox = getJson(url, new MediaType("application", "ld+json"));
        outboxQueryCount++;
        cycleOutboxQueryCount++;
        // log.debug("Outbox: " + XString.prettyPrint(outbox));
        return outbox;
    }

    public APObj getOrderedCollectionPage(String url) {
        if (url == null)
            return null;
        APObj outboxPage = getJson(url, new MediaType("application", "activity+json"));
        // log.debug("OrderedCollectionPage: " + XString.prettyPrint(outboxPage));
        return outboxPage;
    }

    /*
     * Generate webfinger response from our server
     */
    public APObj generateWebFinger(String resource) {
        try {
            if (StringUtils.isNotEmpty(resource) && resource.startsWith("acct:")) {
                String[] parts = resource.substring(5).split("@", 2);
                if (parts.length == 2 && parts[1].equals(appProp.getMetaHost())) {
                    String username = parts[0];

                    SubNode userNode = read.getUserNodeByUserName(null, username);
                    if (userNode != null) {
                        APObj webFinger = new APObj() //
                                .put("subject", "acct:" + username + "@" + appProp.getMetaHost()) //
                                .put("links", new APList() //
                                        .val(new APObj() //
                                                .put("rel", "self") //
                                                .put("type", "application/activity+json") //
                                                .put("href", makeActorUrlForUserName(username))));

                        // log.debug("Reply with WebFinger: " + XString.prettyPrint(webFinger));
                        return webFinger;
                    }
                }
            }
        } catch (Exception e) {
            log.error("webfinger failed", e);
            throw new RuntimeException(e);
        }
        return null;
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

            APObj webFingerOfUserBeingFollowed = getWebFinger(apUserName);
            String actorUrlOfUserBeingFollowed = getActorUrlFromWebFingerObj(webFingerOfUserBeingFollowed);

            adminRunner.run(session -> {
                String sessionActorUrl = makeActorUrlForUserName(ThreadLocals.getSessionContext().getUserName());
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

                APObj toActor = getActorByUrl(actorUrlOfUserBeingFollowed);
                String toInbox = AP.str(toActor, "inbox");
                securePost(session, null, toInbox, sessionActorUrl, followAction);
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

    public void verifySignature(HttpServletRequest httpReq, PublicKey pubKey) {
        String reqHeaderSignature = httpReq.getHeader("Signature");
        if (reqHeaderSignature == null) {
            throw new RuntimeException("Signature missing from http header.");
        }

        final List<String> sigTokens = XString.tokenize(reqHeaderSignature, ",", true);
        if (sigTokens == null || sigTokens.size() < 3) {
            throw new RuntimeException("Signature tokens missing from http header.");
        }

        String keyID = null;
        String signature = null;
        List<String> headers = null;

        for (String sigToken : sigTokens) {
            int equalIdx = sigToken.indexOf("=");

            // ignore tokens not containing equals
            if (equalIdx == -1)
                continue;

            String key = sigToken.substring(0, equalIdx);
            String val = sigToken.substring(equalIdx + 1);

            if (val.charAt(0) == '"') {
                val = val.substring(1, val.length() - 1);
            }

            if (key.equalsIgnoreCase("keyId")) {
                keyID = val;
            } else if (key.equalsIgnoreCase("headers")) {
                headers = Arrays.asList(val.split(" "));
            } else if (key.equalsIgnoreCase("signature")) {
                signature = val;
            }
        }

        if (keyID == null)
            throw new RuntimeException("Header signature missing 'keyId'");
        if (headers == null)
            throw new RuntimeException("Header signature missing 'headers'");
        if (signature == null)
            throw new RuntimeException("Header signature missing 'signature'");
        if (!headers.contains("(request-target)"))
            throw new RuntimeException("(request-target) is not in signed headers");
        if (!headers.contains("date"))
            throw new RuntimeException("date is not in signed headers");
        if (!headers.contains("host"))
            throw new RuntimeException("host is not in signed headers");

        String date = httpReq.getHeader("date");
        validateRequestTime(date);

        /*
         * NOTE: keyId will be the actor url with "#main-key" appended to it, and if we wanted to verify
         * that only incomming messages from users we 'know' are allowed, we could do that, but for now we
         * simply verify that they are who they claim to be using the signature check below, and that is all
         * we want. (i.e. unknown users can post in)
         */

        byte[] signableBytes = getHeaderSignatureBytes(httpReq, headers);
        byte[] sigBytes = Base64.getDecoder().decode(signature);

        try {
            Signature verifier = Signature.getInstance("SHA256withRSA");
            verifier.initVerify(pubKey);
            verifier.update(signableBytes);
            if (!verifier.verify(sigBytes)) {
                throw new RuntimeException("Signature verify failed.");
            }
        } catch (Exception e) {
            throw new RuntimeException("Signature check failed.");
        }
    }

    byte[] getHeaderSignatureBytes(HttpServletRequest httpReq, List<String> headers) {
        ArrayList<String> sigParts = new ArrayList<>();
        for (String header : headers) {
            String value;
            if (header.equals("(request-target)")) {
                value = httpReq.getMethod().toLowerCase() + " " + httpReq.getRequestURI();
            } else {
                value = httpReq.getHeader(header);
            }
            sigParts.add(header + ": " + value);
        }

        String strToSign = String.join("\n", sigParts);
        byte[] signableBytes = strToSign.getBytes(StandardCharsets.UTF_8);
        return signableBytes;
    }

    public void validateRequestTime(String date) {
        try {
            SimpleDateFormat dateFormat = new SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss z", Locale.US);
            dateFormat.setTimeZone(TimeZone.getTimeZone("GMT"));
            long unixtime = dateFormat.parse(date).getTime();
            long now = System.currentTimeMillis();
            long diff = now - unixtime;
            if (diff > 30000L)
                throw new IllegalArgumentException("Date is too far in the future (difference: " + diff + "ms)");
            if (diff < -30000L)
                throw new IllegalArgumentException("Date is too far in the past (difference: " + diff + "ms)");
        } catch (Exception e) {
            throw new RuntimeException("Failed checking time on http request.");
        }
    }

    public PublicKey getPublicKeyFromActor(Object actorObj) {
        PublicKey pubKey = null;
        Object pubKeyObj = AP.obj(actorObj, "publicKey");
        if (pubKeyObj == null)
            return null;

        String pkeyEncoded = AP.str(pubKeyObj, "publicKeyPem");
        if (pkeyEncoded == null)
            return null;

        // I took this replacement logic from 'Smitherene' project, and it seems to work
        // ok, but I haven't really fully vetted it myself.
        // WARNING: This is a REGEX. replaceAll() uses REGEX.
        pkeyEncoded = pkeyEncoded.replaceAll("-----(BEGIN|END) (RSA )?PUBLIC KEY-----", "").replace("\n", "").trim();

        byte[] key = Base64.getDecoder().decode(pkeyEncoded);
        try {
            X509EncodedKeySpec spec = new X509EncodedKeySpec(key);
            pubKey = KeyFactory.getInstance("RSA").generatePublic(spec);
        } catch (Exception ex) {
            log.debug("Failed to generate publicKey from encoded: " + pkeyEncoded);
            // As long as this code path is never needed for Mastogon/Pleroma I'm not going
            // to worry about it, but I can always
            // dig this implementation out of my saved copy of Smitherene if ever needed.
            //
            // a simpler RSA key format, used at least by Misskey
            // FWIW, Misskey user objects also contain a key "isCat" which I ignore
            // RSAPublicKeySpec spec=decodeSimpleRSAKey(key);
            // pubKey=KeyFactory.getInstance("RSA").generatePublic(spec);
        }

        return pubKey;
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

            APObj actorObj = getActorByUrl(actorUrl);
            if (actorObj == null) {
                log.debug("Unable to load actorUrl: " + actorUrl);
                return null;
            }

            PublicKey pubKey = getPublicKeyFromActor(actorObj);
            verifySignature(httpReq, pubKey);

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

    public boolean isLocalUrl(String url) {
        return url != null && url.startsWith(appProp.getHttpProtocol() + "://" + appProp.getMetaHost());
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
        if (isLocalUrl(inReplyTo)) {
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
                APObj followersObj = getJson(url, new MediaType("application", "activity+json"));
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

            if (isLocalActorUrl(actorUrl)) {
                String longUserName = getLongUserNameFromActorUrl(actorUrl);
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

    public String getLongUserNameFromActorUrl(String actorUrl) {
        if (actorUrl == null) {
            return null;
        }

        /*
         * Detect if this actorUrl points to our local server, and get the long name the easy way if so
         */
        if (isLocalActorUrl(actorUrl)) {
            String shortUserName = getLocalUserNameFromActorUrl(actorUrl);
            String longUserName = shortUserName + "@" + appProp.getMetaHost();
            return longUserName;
        }

        APObj actor = getActorByUrl(actorUrl);
        if (actor == null) {
            return null;
        }
        // log.debug("getLongUserNameFromActorUrl: " + actorUrl + "\n" +
        // XString.prettyPrint(actor));
        return getLongUserNameFromActor(actor);
    }

    public String getLongUserNameFromActor(Object actor) {
        String shortUserName = AP.str(actor, "preferredUsername"); // short name like 'alice'
        String inbox = AP.str(actor, "inbox");
        try {
            URL url = new URL(inbox);
            String host = url.getHost();
            return shortUserName + "@" + host;
        } catch (Exception e) {
            log.error("failed building toUserName", e);
        }
        return null;
    }

    boolean isLocalActorUrl(String actorUrl) {
        return actorUrl.startsWith(appProp.getProtocolHostAndPort() + ActPubConstants.ACTOR_PATH + "/");
    }

    /*
     * we know our own actor layout is this: https://ourserver.com/ap/u/userName, so this method just
     * strips the user name by taking what's after the rightmost slash
     */
    public String getLocalUserNameFromActorUrl(String actorUrl) {
        if (!isLocalActorUrl(actorUrl)) {
            log.debug("Invalid local actor Url: " + actorUrl);
            return null;
        }

        int lastIdx = actorUrl.lastIndexOf("/");
        String ret = null;
        if (lastIdx == -1) {
            log.debug("unable to get a user name from actor url: " + actorUrl);
            return null;
        }

        ret = actorUrl.substring(lastIdx + 1);
        return ret;
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

            APObj followerActorObj = getActorByUrl(followerActorUrl);

            // log.debug("getLongUserNameFromActorUrl: " + actorUrl + "\n" +
            // XString.prettyPrint(actor));
            String followerUserName = getLongUserNameFromActor(followerActorObj);
            SubNode followerAccountNode = loadForeignUserByUserName(session, followerUserName);
            userEncountered(followerUserName, false);

            // Actor being followed (local to our server)
            String actorBeingFollowedUrl = AP.str(followAction, "object");
            if (actorBeingFollowedUrl == null) {
                log.debug("no 'object' found on follows action request posted object");
                return null;
            }

            String userToFollow = this.getLocalUserNameFromActorUrl(actorBeingFollowedUrl);
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

            String privateKey = getPrivateKey(session, userToFollow);

            /* Protocol says we need to send this acceptance back */
            Runnable runnable = () -> {
                try {
                    Thread.sleep(500);

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
                    securePost(session, privateKey, followerInbox, actorBeingFollowedUrl, acceptFollow);
                } catch (Exception e) {
                }
            };
            Thread thread = new Thread(runnable);
            thread.start();
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
                actor.put("id", makeActorUrlForUserName(userName));
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
     * Searches thru the 'links' array property on webFinger and returns the links array object that has
     * a 'rel' property that matches the value in the rel param string
     */
    public Object getLinkByRel(Object webFinger, String rel) {
        List<?> linksList = AP.list(webFinger, "links");

        if (linksList == null)
            return null;

        for (Object link : linksList) {
            if (rel.equals(AP.str(link, "rel"))) {
                return link;
            }
        }
        return null;
    }

    public APObj postJson(String url, String headerHost, String headerDate, String headerSig, String digestHeader,
            byte[] bodyBytes) {
        APObj ret = null;
        try {
            // MediaType type = new MediaType("application", "ld+json"); //;
            // profile=\"https://www.w3.org/ns/activitystreams\"");
            HttpHeaders headers = new HttpHeaders();
            // List<MediaType> acceptableMediaTypes = new LinkedList<MediaType>();
            // acceptableMediaTypes.add(type);
            // headers.setAccept(acceptableMediaTypes);
            // headers.add("Accept", "application/ld+json;
            // profile=\"https://www.w3.org/ns/activitystreams\"");

            if (headerHost != null) {
                headers.add("Host", headerHost);
            }

            if (headerDate != null) {
                headers.add("Date", headerDate);
            }

            if (headerSig != null) {
                headers.add("Signature", headerSig);
            }

            if (digestHeader != null) {
                headers.add("Digest", digestHeader);
            }

            HttpEntity<byte[]> requestEntity = new HttpEntity<>(bodyBytes, headers);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, requestEntity, String.class);
            log.debug("Post to " + url + " RESULT: " + response.getStatusCode() + " response=" + response.getBody());
        } catch (Exception e) {
            log.error("postJson failed: " + url, e);
            throw new RuntimeException(e);
        }
        return ret;
    }

    public APObj getJson(String url, MediaType mediaType) {
        APObj ret = null;
        try {
            HttpHeaders headers = new HttpHeaders();
            List<MediaType> acceptableMediaTypes = new LinkedList<MediaType>();
            acceptableMediaTypes.add(mediaType);
            headers.setAccept(acceptableMediaTypes);

            MultiValueMap<String, Object> bodyMap = new LinkedMultiValueMap<>();
            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(bodyMap, headers);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, requestEntity, String.class);
            ret = mapper.readValue(response.getBody(), new TypeReference<>() {
            });
            // log.debug("REQ: " + url + "\nRES: " + XString.prettyPrint(ret));
        } catch (Exception e) {
            log.error("failed getting json: " + url, e);
            throw new RuntimeException(e);
        }
        return ret;
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
                        String actor = makeActorUrlForUserName(userName);

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
                        APObj actor = getActorByUrl(actorUrl);
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

        log.debug("refreshForeignUsers()");

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
        sb.append("Inbox Post count:" + inboxCount + "\n");
        return sb.toString();
    }
}
