package org.subnode.service;

import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.Signature;
import java.security.spec.PKCS8EncodedKeySpec;
import java.text.SimpleDateFormat;
import java.util.Base64;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.apache.commons.lang3.StringUtils;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
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
import org.subnode.config.AppProp;
import org.subnode.config.SessionContext;
import org.subnode.model.client.NodeProp;
import org.subnode.model.client.NodeType;
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
import org.subnode.response.NotificationMessage;
import org.subnode.util.DateUtil;
import org.subnode.util.SubNodeUtil;
import org.subnode.util.Util;
import org.subnode.util.XString;

@Component
public class ActPubService {
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
    private RunAsMongoAdminEx adminRunner;

    @Autowired
    private SessionContext sessionContext;

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

    /* Cache Actor objects by URL in memory only for now */
    private static final HashMap<String, APObj> actorCacheByUrl = new HashMap<String, APObj>();

    /* Cache Actor objects by UserName in memory only for now */
    private static final HashMap<String, APObj> actorCacheByUserName = new HashMap<String, APObj>();

    /* Cache WebFinger objects by UserName in memory only for now */
    private static final HashMap<String, APObj> webFingerCacheByUserName = new HashMap<String, APObj>();

    /*
     * RestTemplate is thread-safe and reusable, and has no state, so we need only
     * one final static instance ever
     */
    private static final RestTemplate restTemplate = new RestTemplate(Util.getClientHttpRequestFactory());
    private static final ObjectMapper mapper = new ObjectMapper();

    // NOTE: This didn't allow unknown properties as expected but putting the
    // following in the JSON classes did:
    // @JsonIgnoreProperties(ignoreUnknown = true)
    {
        mapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    }

    public HashSet<String> parseMentions(String message) {
        HashSet<String> userNames = new HashSet<String>();

        // prepare to that newlines is compatable with out tokenizing
        message = message.replace("\n", " ");
        message = message.replace("\r", " ");

        List<String> words = XString.tokenize(message, " ", true);
        if (words != null) {
            for (String word : words) {
                // detect the pattern @name@server.com or @name
                if (word.startsWith("@") && StringUtils.countMatches(word, "@") <= 2) {
                    word = word.substring(1);

                    // This second 'startsWith' check ensures we ignore patterns that start with
                    // "@@"
                    if (!word.startsWith("@")) {
                        userNames.add(word);
                    }
                }
            }
        }
        return userNames;
    }

    /* Gets private RSA key from current user session */
    private String getPrivateKey(MongoSession session, String userName) {
        /* get the userNode for the current user who edited a node */
        SubNode userNode = read.getUserNodeByUserName(session, userName);
        if (userNode == null) {
            return null;
        }

        /* get private key of this user so we can sign the outbound message */
        String privateKey = userNode.getStrProp(NodeProp.CRYPTO_KEY_PRIVATE);
        if (privateKey == null) {
            log.debug("Unable to update federated users. Our local user didn't have a private key on his userNode: "
                    + sessionContext.getUserName());
            return null;
        }
        return privateKey;
    }

    /*
     * When 'node' has been created under 'parent' (by the sessionContext user) this
     * will send a notification to foreign servers. There are various kinds of types
     * of parents this can happen on (Node types), each being some kind of foreign
     * AP message to reply to.
     */
    public void sendNotificationForNodeEdit(MongoSession session, SubNode parent, SubNode node) {
        try {
            List<String> toUserNames = new LinkedList<String>();

            HashSet<String> mentionsSet = saveMentionsToNodeACL(session, node);
            toUserNames.addAll(mentionsSet);

            boolean privateMessage = true;
            /*
             * Now we need to lookup all userNames from the ACL info, to add them all to
             * 'toUserNames', and we can avoid doing any work for the ones in
             * 'toUserNamesSet', because we know they already are taken care of (in the
             * list)
             */
            for (String k : node.getAc().keySet()) {
                if ("public".equals(k)) {
                    privateMessage = false;
                } else {
                    // k will be a nodeId of an account node here.
                    SubNode accountNode = read.getNode(session, k);

                    if (accountNode != null) {
                        String userName = accountNode.getStrProp(NodeProp.USER.s());
                        toUserNames.add(userName);
                    }
                }
            }

            // String apId = parent.getStringProp(NodeProp.ACT_PUB_ID.s());
            String inReplyTo = parent.getStrProp(NodeProp.ACT_PUB_OBJ_URL);

            /*
             * Get the userName of the user we're replying to. Note: This path works for a
             * DM to a node, but won't the more general solution be to use whatever
             * 
             * In case there's a case where attributedTo can be here, and not already been
             * taken care of this code will come back but for now I consider this redundant
             * until further researched.
             */
            // String attributedTo = parent.getStrProp(NodeProp.ACT_PUB_OBJ_ATTRIBUTED_TO);
            // APObj actor = getActorByUrl(attributedTo);
            // String shortUserName = AP.str(actor, "preferredUsername"); // short name like
            // 'alice'
            // String toInbox = AP.str(actor, "inbox");
            // URL url = new URL(toInbox);
            // String host = url.getHost();
            // String toUserName = shortUserName + "@" + host;
            // toUserNames.add(toUserName);
            /*
             * For now this usage pattern is only functional for a reply from an inbox, and
             * so this supports only DMs thru this code path for now (todo-0: this may
             * change)
             */

            APList attachments = createAttachmentsList(node);

            sendNote(session, toUserNames, sessionContext.getUserName(), inReplyTo, node.getContent(), attachments,
                    subNodeUtil.getIdBasedUrl(node), privateMessage);
        } //
        catch (Exception e) {
            log.error("sendNote failed", e);
            throw new RuntimeException(e);
        }
    }

    /*
     * Parses all mentions (like '@bob@server.com') in the node content text and
     * adds them (if not existing) to the node sharing on the node, which ensures
     * the person mentioned has visibility of this node and that it will also appear
     * in their FEED listing
     */
    public HashSet<String> saveMentionsToNodeACL(MongoSession session, SubNode node) {
        HashSet<String> mentionsSet = parseMentions(node.getContent());

        boolean acChanged = false;
        HashMap<String, AccessControl> ac = node.getAc();

        // make sure all parsed toUserNamesSet user names are saved into the node acl */
        for (String userName : mentionsSet) {
            SubNode acctNode = read.getUserNodeByUserName(session, userName);

            /*
             * If this is a foreign 'mention' user name that is not imported into our
             * system, we auto-import that user now
             */
            if (acctNode == null && StringUtils.countMatches(userName, "@") == 1) {
                acctNode = loadForeignUser(session, userName);
            }

            if (acctNode != null) {
                String acctNodeId = acctNode.getId().toHexString();
                if (ac == null || !ac.containsKey(acctNodeId)) {
                    /*
                     * Lazy create 'ac' so that the net result of this method is never to assign non
                     * null when it could be left null
                     */
                    if (ac == null) {
                        ac = new HashMap<String, AccessControl>();
                    }
                    acChanged = true;
                    ac.put(acctNodeId,
                            new AccessControl("prvs", PrivilegeType.READ.s() + "," + PrivilegeType.WRITE.s()));
                }
            } else {
                log.debug("Mentioned user not found: " + userName);
            }
        }

        if (acChanged) {
            node.setAc(ac);
            update.save(session, node);
        }
        return mentionsSet;
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
                            .put("url", appProp.protocolHostAndPort() + "/f/id/" + node.getId().toHexString()));
        }

        return attachments;
    }

    public String makeActorUrlForUserName(String userName) {
        return appProp.protocolHostAndPort() + ActPubConstants.ACTOR_PATH + "/" + userName;
    }

    public void sendNote(MongoSession session, List<String> toUserNames, String fromUser, String inReplyTo,
            String content, APList attachments, String noteUrl, boolean privateMessage) {

        String host = appProp.getMetaHost();
        String fromActor = null;

        /*
         * todo-0: Need to analyze the scenario where there are multiple 'quanta.wiki'
         * users recieving a notification, and see if this results in multiple inbound
         * posts from a Mastodon server, of if somehow all the mentions are wrapped into
         * a single post to one user or perhaps the global inbox?
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

            APObj webFinger = getWebFinger("https://" + userHost, toUserName);
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

            APObj message = apFactory.newCreateMessageForNote(toUserName, fromActor, inReplyTo, content, toActorUrl,
                    noteUrl, privateMessage, attachments);

            String privateKey = getPrivateKey(session, sessionContext.getUserName());
            securePost(session, privateKey, inbox, fromActor, message);
        }
    }

    /*
     * Note: 'actor' here is the actor URL of a local Quanta-based user,
     */
    private void securePost(MongoSession session, String privateKey, String toInbox, String actor, APObj message) {
        try {
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

            String digestHeader = "SHA-256="
                    + Base64.getEncoder().encodeToString(MessageDigest.getInstance("SHA-256").digest(bodyBytes));

            URL url = new URL(toInbox);
            String host = url.getHost();
            String path = url.getPath();

            String strToSign = "(request-target): post " + path + "\nhost: " + host + "\ndate: " + date + "\ndigest: "
                    + digestHeader;

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
     * todo-0: rename this method to: loadForeignUserByUserName Reads in a user from
     * the Fediverse with a name like: someuser@fosstodon.org
     * 
     * Returns account node of the user
     */
    public SubNode loadForeignUser(MongoSession session, String apUserName) {
        if (!apUserName.contains("@")) {
            log.debug("Invalid foreign user name: " + apUserName);
            return null;
        }

        log.debug("Load foreign user: " + apUserName);
        /* First try to use the actor from cache, if we have it cached */
        synchronized (actorCacheByUserName) {
            Object actor = actorCacheByUserName.get(apUserName);

            // if we have actor object skip the step of getting it and import using it.
            if (actor != null) {
                return importActor(session, actor);
            }
        }

        String host = getHostFromUserName(apUserName);
        APObj webFinger = getWebFinger("https://" + host, apUserName);

        Object self = getLinkByRel(webFinger, "self");
        log.debug("Self Link: " + XString.prettyPrint(self));
        if (self != null) {
            return loadForeignUserByActorUrl(session, AP.str(self, "href"));
        }
        return null;
    }

    public SubNode loadForeignUserByActorUrl(MongoSession session, String actorUrl) {
        Object actor = getActorByUrl(actorUrl);

        // if webfinger was successful, ensure the user is imported into our system.
        if (actor != null) {
            return importActor(session, actor);
        }
        return null;
    }

    // todo-0: refactor loadForeignUser to call this instead of replicating the code
    // there
    public String getActorUrlFromWebFingerObj(Object webFinger) {
        String actorUrl = null;
        Object self = getLinkByRel(webFinger, "self");
        log.debug("Self Link: " + XString.prettyPrint(self));
        if (self != null) {
            actorUrl = AP.str(self, "href");
        }
        return actorUrl;
    }

    /*
     * Returns account node of the user, creating one if not already existing
     * 
     * todo-0: it's redundant to even allow apUserName to be a parameter. We can
     * build it from the actor object
     */
    public SubNode importActor(MongoSession session, Object actor) {

        String apUserName = getLongUserNameFromActor(actor);

        apUserName = apUserName.trim();
        if (apUserName.endsWith("@" + appProp.getMetaHost().toLowerCase())) {
            log.debug("Can't import a user that's not from a foreign server.");
            return null;
        }
        log.debug("importing Actor: " + apUserName);
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
                    changed = changed || userNode.setProp(NodeProp.ACT_PUB_USER_ICON_URL.s(), iconUrl);
                }
            }
        }

        changed = changed || userNode.setProp(NodeProp.USER_BIO.s(), AP.str(actor, "summary"));
        changed = changed || userNode.setProp(NodeProp.ACT_PUB_ACTOR_ID.s(), AP.str(actor, "id"));
        changed = changed || userNode.setProp(NodeProp.ACT_PUB_ACTOR_INBOX.s(), AP.str(actor, "inbox"));
        changed = changed || userNode.setProp(NodeProp.ACT_PUB_ACTOR_URL.s(), AP.str(actor, "url"));

        if (changed) {
            update.save(session, userNode, false);
        }
        refreshOutboxFromForeignServer(session, actor, userNode, apUserName);
        return userNode;
    }

    /*
     * Caller can pass in userNode if it's already available, but if not just pass
     * null and the apUserName will be used to look up the userNode.
     * 
     * todo-0: need to verify it's possible to run this only when the user is
     * initially imported or server restarted, and then queue into memory messages
     * that come into the server as normal inbox events that we can hold in memory
     * (or at least the most recent)
     */
    public void refreshOutboxFromForeignServer(MongoSession session, Object actor, SubNode userNode,
            String apUserName) {

        // Temporarily removing this because we no longer have USER _FEED (outbox) so we
        // will have to rethink
        // if we want to pull in this data in this way or not, or just dump it directly
        // into some node in the user's
        // account.

        // if (userNode == null) {
        // userNode = read.getUserNodeByUserName(session, apUserName);
        // }

        // final SubNode _userNode = userNode;
        // SubNode outboxNode = read.getUserNodeByType(session, apUserName, null, null,
        // NodeType.USER _FEED.s());
        // Iterable<SubNode> outboxItems = read.getSubGraph(session, outboxNode);

        // Object outbox = getOutbox(AP.str(actor, "outbox"));
        // if (outbox == null) {
        // log.debug("Unable to get outbox for AP user: " + apUserName);
        // return;
        // }

        // /*
        // * Generate a list of known AP IDs so we can ignore them and load only the
        // * unknown ones from the foreign server
        // */
        // HashSet<String> apIdSet = new HashSet<String>();
        // for (SubNode n : outboxItems) {
        // String apId = n.getStrProp(NodeProp.ACT_PUB_ID.s());
        // if (apId != null) {
        // apIdSet.add(apId);
        // }
        // }

        // /*
        // * Warning: There are times when even with only two items in the outbox
        // Mastodon
        // * might send back an empty array in the "first" page and the two items in teh
        // * "last" page, which makes no sense, but it just means we have to read and
        // * deduplicate all the items from all pages to be sure we don't end up with a
        // * empty array even when there ARE some
        // */
        // Object ocPage = getOrderedCollectionPage(AP.str(outbox, "first"));
        // int pageNo = 0;
        // while (ocPage != null) {
        // pageNo++;
        // final int _pageNo = pageNo;

        // List<?> orderedItems = AP.list(ocPage, "orderedItems");
        // for (Object apObj : orderedItems) {
        // String apId = AP.str(apObj, "id");
        // if (!apIdSet.contains(apId)) {
        // log.debug("CREATING NODE (AP Obj): " + apId);
        // saveOutboxItem(session, outboxNode, apObj, _pageNo, _userNode.getId());
        // apIdSet.add(apId);
        // }
        // }

        // String nextPage = AP.str(ocPage, "next");
        // log.debug("NextPage: " + nextPage);
        // if (nextPage != null) {
        // ocPage = getOrderedCollectionPage(nextPage);
        // } else {
        // break;
        // }
        // }

        // ocPage = getOrderedCollectionPage(AP.str(outbox, "last"));
        // if (ocPage != null) {
        // List<?> orderedItems = AP.list(ocPage, "orderedItems");
        // for (Object apObj : orderedItems) {
        // String apId = AP.str(apObj, "id");
        // if (!apIdSet.contains(apId)) {
        // log.debug("CREATING NODE (AP Obj): " + apId);
        // saveOutboxItem(session, outboxNode, apObj, -1, _userNode.getId());
        // apIdSet.add(apId);
        // }
        // }
        // }
    }

    public void saveOutboxItem(MongoSession session, SubNode userFeedNode, Object apObj, int pageNo, ObjectId ownerId) {
        Object object = AP.obj(apObj, "object");

        SubNode outboxNode = create.createNodeAsOwner(session, userFeedNode.getPath() + "/?", NodeType.NONE.s(),
                ownerId);
        outboxNode.setProp(NodeProp.ACT_PUB_ID.s(), AP.str(apObj, "id"));
        outboxNode.setProp(NodeProp.ACT_PUB_OBJ_TYPE.s(), AP.str(object, "type"));
        outboxNode.setProp(NodeProp.ACT_PUB_OBJ_URL.s(), AP.str(object, "url"));
        outboxNode.setProp(NodeProp.ACT_PUB_OBJ_INREPLYTO.s(), AP.str(object, "inReplyTo"));
        outboxNode.setProp(NodeProp.ACT_PUB_OBJ_CONTENT.s(),
                object != null ? (/* "Page: " + pageNo + "<br>" + */ AP.str(object, "content")) : "no content");
        outboxNode.setType(NodeType.ACT_PUB_ITEM.s());

        Date published = AP.date(apObj, "published");
        if (published != null) {
            outboxNode.setModifyTime(published);
        }

        update.save(session, outboxNode, false);
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

    // https://server.org/.well-known/webfinger?resource=acct:WClayFerguson@server.org'

    /*
     * Get WebFinger from foreign server
     * 
     * resource example: WClayFerguson@server.org
     * 
     * todo-0: remove 'host' as an argument and just parse it off the 'resource'
     * which we already have a method to do.
     */
    public APObj getWebFinger(String host, String resource) {
        APObj finger = null;

        if (resource.startsWith("@")) {
            resource = resource.substring(1);
        }

        // return from cache if we have this cached
        synchronized (webFingerCacheByUserName) {
            finger = webFingerCacheByUserName.get(resource);
            if (finger != null) {
                return finger;
            }
        }

        String url = host + ActPubConstants.PATH_WEBFINGER + "?resource=acct:" + resource;
        finger = getJson(url, new MediaType("application", "jrd+json"));

        synchronized (webFingerCacheByUserName) {
            if (finger != null) {
                log.debug("Caching WebFinger: " + XString.prettyPrint(finger));
                webFingerCacheByUserName.put(resource, finger);
            }
        }
        return finger;
    }

    /*
     * Effeciently gets the Actor by using a cache to ensure we never get the same
     * Actor twice until the app restarts at least
     */
    public APObj getActorByUrl(String url) {
        if (url == null)
            return null;

        APObj actor = null;

        // return actor from cache if already cached
        synchronized (actorCacheByUrl) {
            actor = actorCacheByUrl.get(url);
            if (actor != null) {
                return actor;
            }
        }

        actor = getJson(url, new MediaType("application", "ld+json"));
        cacheActor(url, actor);

        log.debug("Actor: " + XString.prettyPrint(actor));
        return actor;
    }

    public void cacheActor(String url, APObj actor) {
        if (actor != null) {
            synchronized (actorCacheByUrl) {
                actorCacheByUrl.put(url, actor);
            }

            synchronized (actorCacheByUserName) {
                String userName = getLongUserNameFromActor(actor);
                actorCacheByUserName.put(userName, actor);
            }
        }
    }

    public APObj getOutbox(String url) {
        if (url == null)
            return null;
        APObj outbox = getJson(url, new MediaType("application", "ld+json"));
        log.debug("Outbox: " + XString.prettyPrint(outbox));
        return outbox;
    }

    public APObj getOrderedCollectionPage(String url) {
        if (url == null)
            return null;
        APObj outboxPage = getJson(url, new MediaType("application", "activity+json"));
        log.debug("OrderedCollectionPage: " + XString.prettyPrint(outboxPage));
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

                        log.debug("Reply with WebFinger: " + XString.prettyPrint(webFinger));
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
        String hostOfUserBeingFollowed = getHostFromUserName(apUserName);
        APObj webFingerOfUserBeingFollowed = getWebFinger("https://" + hostOfUserBeingFollowed, apUserName);

        Object selfOfUserBeingFollowed = getLinkByRel(webFingerOfUserBeingFollowed, "self");
        String actorUrlOfUserBeingFollowed = AP.str(selfOfUserBeingFollowed, "href");

        adminRunner.run(session -> {
            String sessionActorUrl = makeActorUrlForUserName(sessionContext.getUserName());
            APObj followAction = new APObj();

            // send follow action
            if (following) {
                followAction //
                        .put("@context", ActPubConstants.CONTEXT_STREAMS) //
                        .put("id", appProp.protocolHostAndPort() + "/follow/" + String.valueOf(new Date().getTime())) //
                        .put("type", "Follow") //
                        .put("actor", sessionActorUrl) //
                        .put("object", actorUrlOfUserBeingFollowed);
            }
            // send unfollow action
            else {
                followAction //
                        .put("@context", ActPubConstants.CONTEXT_STREAMS) //
                        .put("id", appProp.protocolHostAndPort() + "/unfollow/" + String.valueOf(new Date().getTime())) //
                        .put("type", "Undo") //
                        .put("actor", sessionActorUrl) //
                        .put("object", new APObj() //
                                .put("id",
                                        appProp.protocolHostAndPort() + "/unfollow-obj/"
                                                + String.valueOf(new Date().getTime())) //
                                .put("type", "Follow") //
                                .put("actor", sessionActorUrl) //
                                .put("object", actorUrlOfUserBeingFollowed));
            }

            String privateKey = getPrivateKey(session, sessionContext.getUserName());
            APObj toActor = getActorByUrl(actorUrlOfUserBeingFollowed);
            String toInbox = AP.str(toActor, "inbox");
            securePost(session, privateKey, toInbox, sessionActorUrl, followAction);
            return null;
        });
    }

    /*
     * Processes incoming INBOX requests for (Follow, Undo Follow), to be called by
     * foreign servers to follow a user on this server
     */
    public APObj processInboxPost(Object payload) {
        String type = AP.str(payload, "type");

        // Process Create Action
        if ("Create".equals(type)) {
            return processCreateAction(payload);
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

    public APObj processCreateAction(Object payload) {
        APObj _ret = (APObj) adminRunner.run(session -> {

            String actorUrl = AP.str(payload, "actor");
            if (actorUrl == null) {
                log.debug("no 'actor' found on create action request posted object");
                return null;
            }

            APObj actorObj = getActorByUrl(actorUrl);

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
         * If this is a 'reply' post then parse the ID out of this, and if we can find
         * that node by that id then insert the reply under that, instead of the default
         * without this id which is to put in 'inbox'
         */
        String inReplyTo = AP.str(obj, "inReplyTo");

        /* This will say null unless inReplyTo is used to get an id to lookup */
        SubNode nodeBeingRepliedTo = null;

        /*
         * Detect if inReplyTo is formatted like this:
         * 'https://quanta.wiki/app?id=xxxxx' and if so lookup the nodeBeingRepliedTo by
         * using that nodeId
         */
        if (inReplyTo != null && inReplyTo.startsWith(appProp.getHttpProtocol() + "://" + appProp.getMetaHost())) {
            int lastIdx = inReplyTo.lastIndexOf("=");
            String replyToId = null;
            if (lastIdx != -1) {
                replyToId = inReplyTo.substring(lastIdx + 1);
                nodeBeingRepliedTo = read.getNode(session, replyToId, false);
            }
        }

        /*
         * If a foreign user is replying to a specific node, we put the reply under that
         * node
         */
        if (nodeBeingRepliedTo != null) {
            saveNote(session, nodeBeingRepliedTo, obj);
        }
        /*
         * Otherwise the node is not a reply so we put it under POSTS node inside the
         * foreign account node on our server, and then we add 'sharing' to it for each
         * person in the 'to/cc' so that from quanta this new node will show up in those
         * people's FEEDs
         */
        else {
            SubNode actorAccountNode = loadForeignUserByActorUrl(session, actorUrl);
            SubNode postsNode = read.findTypedNodeUnderPath(session, actorAccountNode.getPath(),
                    NodeType.ACT_PUB_POSTS.s());

            // if node was not found, create it.
            if (postsNode == null) {
                postsNode = create.createNode(session, actorAccountNode, null, NodeType.ACT_PUB_POSTS.s(), 0L,
                        CreateNodeLocation.LAST, null);
                postsNode.setOwner(actorAccountNode.getId());
                postsNode.setContent("### Posts");
                update.save(session, postsNode);
            }

            saveNote(session, postsNode, obj);
        }

        // todo-0: add cc processing. Same format as 'to' list above
        // "cc" : [ ],

        return ret;
    }

    public void saveNote(MongoSession session, SubNode parentNode, Object obj) {

        String id = AP.str(obj, "id");
        Date published = AP.date(obj, "published");
        String contentHtml = AP.str(obj, "content");
        String objUrl = AP.str(obj, "url");
        String objAttributedTo = AP.str(obj, "attributedTo");

        /*
         * First look to see if there is a target node already existing in this so we
         * don't add a duplicate
         */
        SubNode newNode = read.findSubNodeByProp(session, parentNode.getPath(), NodeProp.ACT_PUB_ID.s(), id);
        if (newNode != null) {
            log.debug("duplicate ActivityPub post ignored: " + id);
            return;
        }

        newNode = create.createNode(session, parentNode, null, null, 0L, CreateNodeLocation.FIRST, null);

        // foreign account will own this node.
        SubNode toAccountNode = loadForeignUserByActorUrl(session, objAttributedTo);
        newNode.setOwner(toAccountNode.getId());

        // todo-0: need a new node prop type that is just 'html' and tells us to render
        // content as raw html if set, or for now
        // we could be clever and just detect if it DOES have tags and does NOT have
        // '```'
        newNode.setContent(contentHtml);
        newNode.setModifyTime(published);
        newNode.setProp(NodeProp.ACT_PUB_ID.s(), id);
        newNode.setProp(NodeProp.ACT_PUB_OBJ_URL.s(), objUrl);
        newNode.setProp(NodeProp.ACT_PUB_OBJ_ATTRIBUTED_TO.s(), objAttributedTo);

        shareToAllObjectRecipients(session, newNode, obj, "to");
        shareToAllObjectRecipients(session, newNode, obj, "cc");

        update.save(session, newNode);

        addAttachmentIfExists(session, newNode, obj);
        String fromUserName = getLongUserNameFromActorUrl(objAttributedTo);

        NotificationMessage msg = new NotificationMessage("apReply", newNode.getId().toHexString(), contentHtml,
                fromUserName);

        notifyAllObjectRecipients(obj, "to", msg);
        notifyAllObjectRecipients(obj, "cc", msg);
    }

    /*
     * Adds node sharing (ACL) entries for all recipients (i.e. propName==to | cc)
     * 
     * The node save is expected to be done external to this function after this
     * function runs.
     */
    private void shareToAllObjectRecipients(MongoSession session, SubNode node, Object obj, String propName) {
        List<?> list = AP.list(obj, propName);
        if (list != null) {
            HashMap<String, AccessControl> ac = node.getAc();
            if (ac == null) {
                ac = new HashMap<String, AccessControl>();
            }

            /* Build up all the access controls */
            for (Object to : list) {
                if (to instanceof String) {
                    String toActorUrl = (String) to;

                    // If this is a user destination (not public) send message to user.
                    if (toActorUrl.endsWith("#Public")) {
                        ac.put("public", new AccessControl("prvs", PrivilegeType.READ.s()));
                    } else {
                        String longUserName = getLongUserNameFromActorUrl(toActorUrl);
                        SubNode acctNode = read.getUserNodeByUserName(session, longUserName);
                        if (acctNode != null) {
                            ac.put(acctNode.getId().toHexString(), //
                                    new AccessControl("prvs", PrivilegeType.READ.s() + "," + PrivilegeType.WRITE.s()));
                        }
                    }
                } else {
                    log.debug("to list entry not supported: " + to.toString());
                }
            }

            /* Put the access controls on the node */
            node.setAc(ac);
        }
    }

    /* propName = to | cc */
    private void notifyAllObjectRecipients(Object obj, String propName, NotificationMessage msg) {
        List<?> list = AP.list(obj, propName);
        if (list != null) {
            for (Object to : list) {
                if (to instanceof String) {
                    String actorUrl = (String) to;

                    // If this is a user destination (not public) send message to user.
                    if (!actorUrl.endsWith("#Public") && isLocalActorUrl(actorUrl)) {
                        String userName = getLocalUserNameFromActorUrl(actorUrl);
                        userFeedService.sendServerPushInfo(userName, msg);
                    }
                } else {
                    log.debug("to list entry not supported: " + to.toString());
                }
            }
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
                attachmentService.readFromUrl(session, url, node.getId().toHexString(), mediaType, -1);

                // for now we only support one attachment so break out after uploading one.
                break;
            }
        }
    }

    public String getLongUserNameFromActorUrl(String actorUrl) {

        /*
         * Detect if this actorUrl points to out local server, and get the long name the
         * easy way if so
         */
        if (actorUrl.startsWith(appProp.getHttpProtocol() + "://" + appProp.getMetaHost())) {
            String shortUserName = getLocalUserNameFromActorUrl(actorUrl);
            String longUserName = shortUserName + "@" + appProp.getMetaHost();
            return longUserName;
        }

        APObj actor = getActorByUrl(actorUrl);
        // log.debug("getLongUserNameFromActorUrl: " + actorUrl + "\n" +
        // XString.prettyPrint(actor));
        return getLongUserNameFromActor(actor);
    }

    /*
     * There's at least one place in this method that should be calling this method
     * but is embedding the code inline instead (fix it: todo-0)
     */
    public String getLongUserNameFromActor(Object actor) {
        String shortUserName = AP.str(actor, "preferredUsername"); // short name like 'alice'
        String inbox = AP.str(actor, "inbox");
        URL url = null;
        String userName = null;
        try {
            url = new URL(inbox);
            String host = url.getHost();
            userName = shortUserName + "@" + host;
        } catch (Exception e) {
            log.error("failed building toUserName", e);
            throw new RuntimeException(e);
        }
        return userName;
    }

    boolean isLocalActorUrl(String actorUrl) {
        return actorUrl.startsWith(appProp.protocolHostAndPort() + ActPubConstants.ACTOR_PATH + "/");
    }

    /*
     * we know our own actor layout is this: https://ourserver.com/ap/u/userName, so
     * this method just strips the user name by taking what's after the rightmost
     * slash
     */
    public String getLocalUserNameFromActorUrl(String actorUrl) {
        if (!isLocalActorUrl(actorUrl)) {
            log.debug("Invalid quanta actor Url: " + actorUrl);
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
     * Process inbound 'Follow' actions (comming from foreign servers). This results
     * in the follower an account node in our local DB created if not already
     * existing, and then a FRIEND node under his FRIENDS_LIST created to represent
     * the person he's following, if not already existing.
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

            // todo-0: make sure repeat calls to this don't redundantly call foreign servers
            // (after could have cached results)
            SubNode followerAccountNode = loadForeignUser(session, followerUserName);

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
            SubNode followerFriendList = read.getUserNodeByType(session, followerUserName, null, null,
                    NodeType.FRIEND_LIST.s());

            /*
             * lookup to see if this followerFriendList node already has userToFollow
             * already under it
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

    public APObj generateDummyOrderedCollection(String userName, String path) {
        String host = appProp.protocolHostAndPort();
        APObj obj = new APObj();
        obj.put("@context", ActPubConstants.CONTEXT_STREAMS);
        obj.put("id", host + path);
        obj.put("type", "OrderedCollection");
        obj.put("totalItems", 0);
        return obj;
    }

    public APObj generateFollowers(String userName) {
        String url = appProp.protocolHostAndPort() + ActPubConstants.PATH_FOLLOWERS + "/" + userName;
        Long totalItems = getFollowersCount(userName);

        return new APObj() //
                .put("@context", ActPubConstants.CONTEXT_STREAMS) //
                .put("id", url) //
                .put("type", "OrderedCollection") //
                .put("totalItems", totalItems) //
                .put("first", url + "?page=true") //
                .put("last", url + "?min_id=0&page=true");
    }

    public APObj generateOutbox(String userName) {
        String url = appProp.protocolHostAndPort() + ActPubConstants.PATH_OUTBOX + "/" + userName;
        Long totalItems = getOutboxItemCount(userName);

        return new APObj() //
                .put("@context", ActPubConstants.CONTEXT_STREAMS) //
                .put("id", url) //
                .put("type", "OrderedCollection") //
                .put("totalItems", totalItems) //
                .put("first", url + "?page=true") //
                .put("last", url + "?min_id=0&page=true");
    }

    public Long getOutboxItemCount(final String userName) {
        Long totalItems = (Long) adminRunner.run(mongoSession -> {
            long count = 0;
            SubNode userNode = read.getUserNodeByUserName(null, userName);
            if (userNode != null) {
                count = auth.countSubGraphByAclUser(mongoSession, null, userNode.getId().toHexString());
            }
            return Long.valueOf(count);
        });
        return totalItems;
    }

    /*
     * if minId=="0" that means "last page", and if minId==null it means first page
     */
    public APObj generateOutboxPage(String userName, String minId) {
        APList items = getOutboxItems(userName, minId);

        // this is a self-reference url (id)
        String url = appProp.protocolHostAndPort() + ActPubConstants.PATH_OUTBOX + "/" + userName + "?min_id=" + minId
                + "&page=true";

        return new APObj() //
                .put("@context", ActPubConstants.CONTEXT_STREAMS) //
                .put("id", url) //
                .put("type", "OrderedCollectionPage") //
                .put("orderedItems", items) //
                .put("totalItems", items.size());
    }

    public APObj generateFollowersPage(String userName, String minId) {
        List<String> followers = getFollowers(userName, minId);

        // this is a self-reference url (id)
        String url = appProp.protocolHostAndPort() + ActPubConstants.PATH_FOLLOWERS + "/" + userName + "?page=true";
        if (minId != null) {
            url += "&min_id=" + minId;
        }
        return new APObj() //
                .put("@context", ActPubConstants.CONTEXT_STREAMS) //
                .put("id", url) //
                .put("type", "OrderedCollectionPage") //
                .put("orderedItems", followers) //
                // todo-0: my outbox isn't returning the 'partOf', so somehow that must mean the
                // mastodon replies don't? Make sure we are doing same as Mastodon behavior
                // here.
                .put("partOf", appProp.protocolHostAndPort() + ActPubConstants.PATH_FOLLOWERS + "/" + userName)//
                .put("totalItems", followers.size());
    }

    public List<String> getFollowers(String userName, String minId) {
        final List<String> followers = new LinkedList<String>();

        adminRunner.run(session -> {
            Iterable<SubNode> iter = read.findFollowersOfUser(session, userName);

            for (SubNode n : iter) {
                log.debug("Follower found: " + XString.prettyPrint(n));
                followers.add(n.getStrProp(NodeProp.ACT_PUB_ACTOR_URL));
            }
            return null;
        });

        return followers;
    }

    public Long getFollowersCount(String userName) {
        return (Long) adminRunner.run(session -> {
            Long count = read.countFollowersOfUser(session, userName);
            return count;
        });
    }

    /*
     * Generates an Actor object for one of our own local users
     */
    public APObj generateActor(String userName) {
        String host = appProp.protocolHostAndPort();

        try {
            SubNode userNode = read.getUserNodeByUserName(null, userName);
            if (userNode != null) {
                String publicKey = userNode.getStrProp(NodeProp.CRYPTO_KEY_PUBLIC.s());
                if (publicKey == null) {
                    throw new RuntimeException("User has no crypto keys. This means they have never logged in?");
                }

                String avatarMime = userNode.getStrProp(NodeProp.BIN_MIME.s());
                String avatarVer = userNode.getStrProp(NodeProp.BIN.s());
                String avatarUrl = appProp.protocolHostAndPort() + AppController.API_PATH + "/bin/avatar" + "?nodeId="
                        + userNode.getId().toHexString() + "&v=" + avatarVer;

                String headerImageMime = userNode.getStrProp(NodeProp.BIN_MIME.s() + "Header");
                String headerImageVer = userNode.getStrProp(NodeProp.BIN.s() + "Header");
                String headerImageUrl = appProp.protocolHostAndPort() + AppController.API_PATH + "/bin/profileHeader"
                        + "?nodeId=" + userNode.getId().toHexString() + "&v=" + headerImageVer;

                APObj actor = new APObj();

                actor.put("@context", new APList() //
                        .val(ActPubConstants.CONTEXT_STREAMS) //
                        .val(ActPubConstants.CONTEXT_SECURITY));

                /*
                 * Note: this is a self-reference, and must be identical to the URL that returns
                 * this object
                 */
                actor.put("id", makeActorUrlForUserName(userName));
                actor.put("type", "Person");
                actor.put("preferredUsername", userName);
                actor.put("name", userName); // this should be ordinary name (first last)

                actor.put("icon", new APObj() //
                        .put("type", "Image") //
                        .put("mediaType", avatarMime) //
                        .put("url", avatarUrl));

                actor.put("image", new APObj() //
                        .put("type", "Image") //
                        .put("mediaType", headerImageMime) //
                        .put("url", headerImageUrl));

                actor.put("summary", userNode.getStrProp(NodeProp.USER_BIO.s()));
                actor.put("inbox", host + ActPubConstants.PATH_INBOX + "/" + userName); //
                actor.put("outbox", host + ActPubConstants.PATH_OUTBOX + "/" + userName); //
                actor.put("followers", host + ActPubConstants.PATH_FOLLOWERS + "/" + userName);
                actor.put("following", host + ActPubConstants.PATH_FOLLOWING + "/" + userName);

                /*
                 * This "/u/[user]/home" url format access the node the user has named 'home'.
                 * This node is auto-created if not found, and will also be public (readable) to
                 * all users because any node named 'home' is automatically madd public
                 */
                actor.put("url", host + "/u/" + userName + "/home");

                actor.put("endpoints", new APObj().put("sharedInbox", host + ActPubConstants.PATH_INBOX));

                actor.put("publicKey", new APObj() //
                        .put("id", AP.str(actor, "id") + "#main-key") //
                        .put("owner", AP.str(actor, "id")) //
                        .put("publicKeyPem",
                                "-----BEGIN PUBLIC KEY-----\n" + publicKey + "\n-----END PUBLIC KEY-----\n"));

                actor.put("supportsFriendRequests", true);

                log.debug("Reply with Actor: " + XString.prettyPrint(actor));
                return actor;
            }
        } catch (Exception e) {
            log.error("actor query failed", e);
            throw new RuntimeException(e);
        }
        return null;
    }

    /*
     * Searches thru the 'links' array property on webFinger and returns the links
     * array object that has a 'rel' property that matches the value in the rel
     * param string
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
            ret = mapper.readValue(response.getBody(), new TypeReference<APObj>() {
            });
            log.debug("REQ: " + url + "\nRES: " + XString.prettyPrint(ret));
        } catch (Exception e) {
            log.error("failed getting json: " + url, e);
            throw new RuntimeException(e);
        }
        return ret;
    }

    /*
     * todo-0: Security isn't implemented on this call yet so a hacker can
     * theoretically inject any userName into the api for this to retrieve shared
     * nodes anyone has shared.
     */
    public APList getOutboxItems(String userName, String minId) {
        String host = appProp.protocolHostAndPort();
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

                for (SubNode child : auth.searchSubGraphByAclUser(mongoSession, null, userNode.getId().toHexString(),
                        SubNode.FIELD_MODIFY_TIME, MAX_PER_PAGE)) {

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
}
