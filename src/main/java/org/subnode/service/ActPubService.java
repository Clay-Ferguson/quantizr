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
import java.util.Map;
import java.util.TimeZone;

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
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.subnode.actpub.APList;
import org.subnode.actpub.APObj;
import org.subnode.actpub.ActPubFactory;
import org.subnode.actpub.VisitAPObj;
import org.subnode.config.AppProp;
import org.subnode.config.SessionContext;
import org.subnode.model.client.NodeProp;
import org.subnode.model.client.NodeType;
import org.subnode.mongo.CreateNodeLocation;
import org.subnode.mongo.MongoCreate;
import org.subnode.mongo.MongoDelete;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.MongoUpdate;
import org.subnode.mongo.MongoUtil;
import org.subnode.mongo.RunAsMongoAdminEx;
import org.subnode.mongo.model.SubNode;
import org.subnode.response.InboxPushInfo;
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
    private AppProp appProp;

    @Autowired
    private SubNodeUtil subNodeUtil;

    /* Cache Actor objects by URL in memory only for now */
    private static final HashMap<String, APObj> actorCache = new HashMap<String, APObj>();

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

    /*
     * When 'node' has been created under 'parent' (by the sessionContext user) this
     * will send a notification to foreign servers. There are various kinds of types
     * of parents this can happen on (Node types), each being some kind of foreign
     * AP message to reply to.
     */
    public void sendNotificationForNodeEdit(SubNode parent, SubNode node) {
        adminRunner.run(session -> {
            try {
                /* get the userNode for the current user who edited a node */
                SubNode userNode = read.getUserNodeByUserName(session, sessionContext.getUserName());
                if (userNode == null) {
                    return null;
                }

                /* get private key of this user so we can sign the outbound message */
                String privateKey = userNode.getStrProp(NodeProp.CRYPTO_KEY_PRIVATE);
                if (privateKey == null) {
                    log.debug(
                            "Unable to update federated users. Our local user didn't have a private key on his userNode: "
                                    + sessionContext.getUserName());
                    return null;
                }

                String inReplyTo = null;
                String toInbox = null;
                String toActor = null;
                String toUserName = null;
                boolean privateMessage = true;
                SubNode apUserNode = null;

                /*
                 * Note: The 'parent' node here can be either an ActivityPub ACT_PUB_ITEM node
                 * or else a FRIEND node of a foreign friend,
                 * 
                 * If this is a friend-type node we get "sn:user" property and expect that to be
                 * something like user@foreignServer.com.
                 */
                // parent==ACT_PUB_ITEM
                if (parent.getType().equals(NodeType.ACT_PUB_ITEM.s())) {
                    inReplyTo = parent.getStrProp(NodeProp.ACT_PUB_ID);

                    /*
                     * Get the owner node of the parent because that's where the properties are that
                     * we need to send this message to the outbox of that user
                     */
                    apUserNode = read.getNode(session, parent.getOwner(), false);

                    if (apUserNode == null) {
                        throw new RuntimeException(
                                "unable to get apUserNode from the owner of parent (an ACT_PUB_ITEM type) node with id="
                                        + parent.getId().toHexString());
                    }

                    /*
                     * Depending on which icon (public reply or DM (private message)) the user
                     * clicked when creating this node, it can be a public or a private reply, and
                     * we will have set the ACT_PUB_PRIVATE flag at that time so that we can detect
                     * it now for sending out
                     */
                    privateMessage = node.getBooleanProp(NodeProp.ACT_PUB_PRIVATE.s());

                    toInbox = apUserNode.getStrProp(NodeProp.ACT_PUB_ACTOR_INBOX);
                    toActor = apUserNode.getStrProp(NodeProp.ACT_PUB_ACTOR_URL);
                    toUserName = apUserNode.getStrProp(NodeProp.USER.s());
                }
                // parent==Friend node
                else if (parent.getType().equals(NodeType.FRIEND.s())) {
                    String apUserName = parent.getStrProp(NodeProp.USER);
                    apUserNode = read.getUserNodeByUserName(session, apUserName);
                    privateMessage = true;

                    if (apUserNode == null) {
                        throw new RuntimeException(
                                "unable to get apUserNode from the sn:user property of parent (a FRIEND type) node with id="
                                        + parent.getId().toHexString());
                    }

                    toInbox = apUserNode.getStrProp(NodeProp.ACT_PUB_ACTOR_INBOX);
                    toActor = apUserNode.getStrProp(NodeProp.ACT_PUB_ACTOR_URL);
                    toUserName = apUserNode.getStrProp(NodeProp.USER.s());
                }
                // parent==InboxEntry node (a node in a user's inbox)
                else if (parent.getType().equals(NodeType.INBOX_ENTRY.s())) {
                    // String apId = parent.getStringProp(NodeProp.ACT_PUB_ID.s());

                    // todo-0: check this. I have only 90% confidence. (could be apId?)
                    inReplyTo = parent.getStrProp(NodeProp.ACT_PUB_OBJ_URL);

                    String attributedTo = parent.getStrProp(NodeProp.ACT_PUB_OBJ_ATTRIBUTED_TO);
                    APObj actor = getActor(attributedTo);

                    String shortUserName = actor.getStr("preferredUsername"); // short name like 'alice'
                    toInbox = actor.getStr("inbox");
                    URL url = new URL(toInbox);
                    String host = url.getHost();
                    toUserName = shortUserName + "@" + host;
                    toActor = attributedTo;

                    // For now this usage pattern is only functional for a reply from an inbox, and
                    // so this is a DM only
                    // thru this code path for now (todo-0: this may change)
                    privateMessage = true;
                }
                // otherwise we can't handle
                else {
                    throw new RuntimeException("Unable to send message under node type: " + node.getType());
                }

                sendNote(toUserName, privateKey, toInbox, sessionContext.getUserName(), inReplyTo, node.getContent(),
                        toActor, subNodeUtil.getIdBasedUrl(node), privateMessage);
            } //
            catch (Exception e) {
                log.error("sendNote failed", e);
                throw new RuntimeException(e);
            }
            return null;
        });
    }

    public void sendNote(String toUserName, String privateKey, String toInbox, String fromUser, String inReplyTo,
            String content, String toActor, String noteUrl, boolean privateMessage) {
        try {
            String actor = appProp.protocolHostAndPort() + "/ap/u/" + fromUser;

            APObj message = apFactory.newCreateMessageForNote(toUserName, actor, inReplyTo, content, toActor, noteUrl,
                    privateMessage);
            String body = XString.prettyPrint(message);
            byte[] bodyBytes = body.getBytes(StandardCharsets.UTF_8);
            log.debug("Sending Message: " + body);

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
            log.error("sendNote failed", e);
            throw new RuntimeException(e);
        }
    }

    /*
     * Reads in a user from the Fediverse with a name like: someuser@fosstodon.org
     */
    public void loadForeignUser(MongoSession session, String apUserName) {
        String host = getHostFromUserName(apUserName);
        APObj webFinger = getWebFinger("https://" + host, apUserName);

        Map<String, Object> self = getLinkByRel(webFinger, "self");
        log.debug("Self Link: " + XString.prettyPrint(self));
        if (self != null) {
            APObj actor = getActor((String) self.get("href"));

            // if webfinger was successful, ensure the user is imported into our system.
            if (actor != null) {
                importActor(session, apUserName, actor);
            }
        }
    }

    public void importActor(MongoSession session, String apUserName, APObj actor) {
        if (apUserName == null)
            return;

        apUserName = apUserName.trim();
        if (apUserName.endsWith("@" + appProp.getMetaHost().toLowerCase())) {
            log.debug("Can't import a user that's not from a foreign server.");
            return;
        }
        log.debug("importing Actor: " + apUserName);
        SubNode userNode = read.getUserNodeByUserName(session, apUserName);

        /*
         * If we don't have this user in our system, create them.
         */
        if (userNode == null) {
            userNode = util.createUser(session, apUserName, null, null, true);
        }

        /*
         * todo-1: setting properties on userNode here needs to detect if we changed the
         * prop, and then only call update.save() if the node HAS changed. Do it by
         * making setProp return boolean if changed.
         */
        APObj icon = actor.getAPObj("icon");
        if (icon != null) {
            String iconUrl = icon.getStr("url");
            if (iconUrl != null) {
                String curIconUrl = userNode.getStrProp(NodeProp.ACT_PUB_USER_ICON_URL.s());
                if (!iconUrl.equals(curIconUrl)) {
                    userNode.setProp(NodeProp.ACT_PUB_USER_ICON_URL.s(), iconUrl);
                }
            }
        }

        userNode.setProp(NodeProp.USER_BIO.s(), actor.getStr("summary"));
        userNode.setProp(NodeProp.ACT_PUB_ACTOR_URL.s(), actor.getStr("id"));
        userNode.setProp(NodeProp.ACT_PUB_ACTOR_INBOX.s(), actor.getStr("inbox"));
        userNode.setProp(NodeProp.ACT_PUB_USER_URL.s(), actor.getStr("url"));

        update.save(session, userNode, false);
        refreshOutboxFromForeignServer(session, actor, userNode, apUserName);
    }

    /*
     * Caller can pass in userNode if it's already available, but if not just pass
     * null and the apUserName will be used to look up the userNode
     */
    public void refreshOutboxFromForeignServer(MongoSession session, APObj actor, SubNode userNode, String apUserName) {

        if (userNode == null) {
            userNode = read.getUserNodeByUserName(session, apUserName);
        }

        final SubNode _userNode = userNode;
        SubNode outboxNode = read.getUserNodeByType(session, apUserName, null, null, NodeType.USER_FEED.s());
        Iterable<SubNode> outboxItems = read.getSubGraph(session, outboxNode);

        /*
         * Generate a list of known AP IDs so we can ignore them and load only the
         * unknown ones from the foreign server
         */
        HashSet<String> apIdSet = new HashSet<String>();
        for (SubNode n : outboxItems) {
            String apId = n.getStrProp(NodeProp.ACT_PUB_ID.s());
            if (apId != null) {
                apIdSet.add(apId);
            }
        }

        APObj outbox = getOutbox(actor.getStr("outbox"));
        if (outbox == null) {
            log.debug("Unable to get outbox for AP user: " + apUserName);
            return;
        }

        /*
         * Warning: There are times when even with only two items in the outbox Mastodon
         * might send back an empty array in the "first" page and the two items in teh
         * "last" page, which makes no sense, but it just means we have to read and
         * deduplicate all the items from all pages to be sure we don't end up with a
         * empty array even when there ARE some
         */
        APObj ocPage = getOrderedCollectionPage(outbox.getStr("first"));
        int pageNo = 0;
        while (ocPage != null) {
            pageNo++;
            final int _pageNo = pageNo;

            Object orderedItems = ocPage.getList("orderedItems");
            iterate(orderedItems, apObj -> {
                String apId = apObj.getStr("id");
                if (!apIdSet.contains(apId)) {
                    log.debug("CREATING NODE (AP Obj): " + apId);
                    saveOutboxItem(session, outboxNode, apObj, _pageNo, _userNode.getId());
                    apIdSet.add(apId);
                }
                return true; // true=keep iterating.
            });

            String nextPage = ocPage.getStr("next");
            log.debug("NextPage: " + nextPage);
            if (nextPage != null) {
                ocPage = getOrderedCollectionPage(nextPage);
            } else {
                break;
            }
        }

        ocPage = getOrderedCollectionPage(outbox.getStr("last"));
        if (ocPage != null) {
            Object orderedItems = ocPage.getList("orderedItems");
            iterate(orderedItems, apObj -> {
                String apId = apObj.getStr("id");
                if (!apIdSet.contains(apId)) {
                    log.debug("CREATING NODE (AP Obj): " + apId);
                    saveOutboxItem(session, outboxNode, apObj, -1, _userNode.getId());
                    apIdSet.add(apId);
                }
                return true; // true=keep iterating.
            });
        }
    }

    public void saveOutboxItem(MongoSession session, SubNode userFeedNode, APObj apObj, int pageNo, ObjectId ownerId) {
        APObj object = apObj.getAPObj("object");

        SubNode outboxNode = create.createNodeAsOwner(session, userFeedNode.getPath() + "/?", NodeType.NONE.s(),
                ownerId);
        outboxNode.setProp(NodeProp.ACT_PUB_ID.s(), apObj.getStr("id"));
        outboxNode.setProp(NodeProp.ACT_PUB_OBJ_TYPE.s(), object.getStr("type"));
        outboxNode.setProp(NodeProp.ACT_PUB_OBJ_URL.s(), object.getStr("url"));
        outboxNode.setProp(NodeProp.ACT_PUB_OBJ_INREPLYTO.s(), object.getStr("inReplyTo"));
        outboxNode.setProp(NodeProp.ACT_PUB_OBJ_CONTENT.s(),
                object != null ? (/* "Page: " + pageNo + "<br>" + */ object.getStr("content")) : "no content");
        outboxNode.setType(NodeType.ACT_PUB_ITEM.s());

        Date published = apObj.getDate("published");
        if (published != null) {
            outboxNode.setModifyTime(published);
        }

        update.save(session, outboxNode, false);
    }

    public void iterate(Object list, VisitAPObj visitor) {
        if (list instanceof List) {
            for (Object obj : (List<?>) list) {
                if (!visitor.visit(new APObj(obj))) {
                    break;
                }
            }
            return;
        }
        throw new RuntimeException("Unable to iterate type: " + list.getClass().getName());
    }

    public String getHostFromUserName(String userName) {
        int atIdx = userName.indexOf("@");
        if (atIdx == -1)
            return null;
        return userName.substring(atIdx + 1);
    }

    public String stripHostFromUserName(String userName) {
        int atIdx = userName.indexOf("@");
        if (atIdx == -1)
            return userName;
        return userName.substring(0, atIdx);
    }

    // https://server.org/.well-known/webfinger?resource=acct:WClayFerguson@server.org'

    /* Get WebFinger from foreign server */
    public APObj getWebFinger(String host, String resource) {
        String url = host + "/.well-known/webfinger?resource=acct:" + resource;
        APObj finger = getJson(url, new MediaType("application", "jrd+json"));
        log.debug("WebFinger: " + XString.prettyPrint(finger));
        return finger;
    }

    /*
     * Effeciently gets the Actor by using a cache to ensure we never get the same
     * Actor twice until the app restarts at least
     */
    public APObj getActor(String url) {
        if (url == null)
            return null;

        APObj actor = null;

        // return actor from cache if already cached
        synchronized (actorCache) {
            actor = actorCache.get(url);
            if (actor != null) {
                return actor;
            }
        }

        actor = getJson(url, new MediaType("application", "ld+json"));

        if (actor != null) {
            synchronized (actorCache) {
                actorCache.put(url, actor);
            }
        }

        log.debug("Actor: " + XString.prettyPrint(actor));
        return actor;
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
        String host = appProp.protocolHostAndPort();

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
                                                .put("href", host + "/ap/u/" + username) // ActivityPub "actor" url
                                        ));

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
     * Processes incoming INBOX requests for (Follow, Undo Follow), to be called by
     * foreign servers to follow a user on this server
     */
    public APObj processInboxPost(APObj payload) {
        // Process Create Action
        if ("Create".equals(payload.getStr("type"))) {
            return processCreateAction(payload);
        }
        // Process Follow Action
        else if ("Follow".equals(payload.getStr("type"))) {
            // todo-0: display browser notification of this event.
            return processFollowAction(payload);
        }
        // Process Undo Action (Unfollow, etc)
        else if ("Undo".equals(payload.getStr("type"))) {
            // todo-0: display browser notification of this event.
            return processUndoAction(payload);
        }
        // else report unhandled
        else {
            log.debug("inbox (post) REST not handled:" + XString.prettyPrint(payload));
        }
        return null;
    }

    public APObj processUndoAction(APObj payload) {
        APObj object = payload.getAPObj("object");
        if (object != null && "Follow".equals(object.getStr("type"))) {
            return processUnfollowAction(object);
        }
        return null;
    }

    public APObj processUnfollowAction(APObj object) {
        // Actor URL of actor doing the folloing
        String followerActor = object.getStr("actor");
        if (followerActor == null) {
            log.debug("no 'actor' found on follows action request posted object");
            return null;
        }

        // Actor being followed (local to our server)
        String actorUrl = object.getStr("object");
        if (actorUrl == null) {
            log.debug("no 'object' found on follows action request posted object");
            return null;
        }

        /*
         * Not sure if this is the best way to convert one of our own actor URL into the
         * username, but unless paths change this should work
         */
        int lastIdx = actorUrl.lastIndexOf("/");
        String userToFollow = null;
        if (lastIdx == -1) {
            log.debug("unable to get a user name from actor url: " + actorUrl);
            return null;
        }

        userToFollow = actorUrl.substring(lastIdx + 1);
        final String _userToFollow = userToFollow;

        APObj _ret = (APObj) adminRunner.run(session -> {
            SubNode followersListNode = read.getUserNodeByType(session, _userToFollow, null, null,
                    NodeType.FOLLOWERS_LIST.s());
            Iterable<SubNode> followers = read.searchSubGraph(session, followersListNode,
                    NodeProp.ACT_PUB_ACTOR_URL.s(), followerActor, null, 0, false, true);

            /*
             * There should only be a maximum of one item in this loop ever, but it's still
             * correct to delete all if there were ever any multiples
             */
            for (SubNode n : followers) {
                delete.deleteNode(session, n, false);
            }

            /*
             * todo-0: this is my 'guess' at what a response to an Undo would look like.
             * Haven't confirmed yet. I'm betting even if this is wrong things will still
             * work ok (for now)
             */
            APObj ret = new APObj() //
                    .put("@context", "https://www.w3.org/ns/activitystreams") //
                    .put("summary", "Accepted unfollow request") //
                    .put("type", "Accept") //
                    .put("actor", actorUrl) //
                    .put("object", new APObj() //
                            .put("type", "Undo") //
                            .put("actor", followerActor) //
                            .put("object", actorUrl) //
            );
            log.debug("Reply to Undo Follow Request: " + XString.prettyPrint(ret));
            return ret;
        });
        return _ret;
    }

    public APObj processCreateAction(APObj payload) {
        APObj _ret = (APObj) adminRunner.run(session -> {
            APObj object = payload.getAPObj("object");
            if (object != null && "Note".equals(object.getStr("type"))) {
                return processCreateNote(session, object);
            } else {
                log.debug("Unhandled Create action (object type not supported): " + XString.prettyPrint(payload));
            }
            return null;
        });
        return _ret;
    }

    /* obj is the 'Note' object */
    public APObj processCreateNote(MongoSession session, APObj obj) {
        APObj ret = new APObj();

        // ID only used for (future) deduplication
        String id = obj.getStr("id");
        Date published = obj.getDate("published");

        String objUrl = obj.getStr("url");
        String objAttributedTo = obj.getStr("attributedTo");

        /*
         * If this is a 'reply' post then parse the ID out of this, and if we can find
         * that node by that id then insert the reply under that, instead of the default
         * without this id which is to put in 'inbox'
         * 
         * Also todo-0: how are we notifying the user in realtime that this reply was
         * just come in?
         */
        String inReplyTo = obj.getStr("inReplyTo");

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

        String contentHtml = obj.getStr("content");

        List<Object> toList = obj.getList("to");
        if (toList != null) {
            for (Object to : toList) {
                if (to instanceof String) {
                    String toActor = (String) to;
                    if (nodeBeingRepliedTo != null) {
                        saveNoteAsReplyUnderNode(session, toActor, contentHtml, id, published, nodeBeingRepliedTo,
                                objUrl, objAttributedTo);
                    } else {
                        saveNoteToUserInboxNode(session, toActor, contentHtml, id, published, objUrl, objAttributedTo);
                    }
                } else {
                    log.debug("to list entry not supported: " + to.toString());
                }
            }
        }

        // todo-0: add cc processing. Same format as 'to' list above
        // "cc" : [ ],

        return ret;
    }

    public void saveNoteAsReplyUnderNode(MongoSession session, String actorUrl, String contentHtml, String id,
            Date published, SubNode nodeBeingRepliedTo, String objUrl, String objAttributedTo) {
        String localUserName = getLocalUserNameFromActorUrl(actorUrl);
        if (localUserName == null) {
            log.debug("actorUrl not handled: " + actorUrl);
            return;
        }
        SubNode userNode = read.getUserNodeByUserName(session, localUserName);
        if (userNode == null)
            return;

        /*
         * First look to see if there is a target node already existing in this so we
         * don't add a dupliate
         */
        SubNode newNode = read.findSubNodeByProp(session, nodeBeingRepliedTo.getPath(), NodeProp.ACT_PUB_ID.s(), id);
        if (newNode != null) {
            log.debug("duplicate ActivityPub post ignored: " + id);
            return;
        }

        newNode = create.createNode(session, nodeBeingRepliedTo, null, NodeType.INBOX_ENTRY.s(), 0L,
                CreateNodeLocation.FIRST, null);

        newNode.setOwner(userNode.getId());

        // todo-0: need a new node prop type that is just 'html' and tells us to render
        // content as raw html if set, or for now
        // we could be clever and just detect if it DOES have tags and does NOT have
        // '```'
        newNode.setContent(contentHtml);
        newNode.setModifyTime(published);
        newNode.setProp(NodeProp.ACT_PUB_ID.s(), id);
        newNode.setProp(NodeProp.ACT_PUB_OBJ_URL.s(), objUrl);
        newNode.setProp(NodeProp.ACT_PUB_OBJ_ATTRIBUTED_TO.s(), objAttributedTo);
        update.save(session, newNode);

        String toUserName = getLongUserNameFromActorUrl(objAttributedTo);

        userFeedService.sendServerPushInfo(localUserName,
                new InboxPushInfo("apReply", newNode.getId().toHexString(), contentHtml, toUserName));
    }

    public void saveNoteToUserInboxNode(MongoSession session, String actorUrl, String contentHtml, String id,
            Date published, String objUrl, String objAttributedTo) {
        String localUserName = getLocalUserNameFromActorUrl(actorUrl);
        if (localUserName == null) {
            log.debug("actorUrl not handled: " + actorUrl);
            return;
        }
        SubNode userNode = read.getUserNodeByUserName(session, localUserName);
        if (userNode == null)
            return;

        SubNode userInbox = read.getUserNodeByType(session, null, userNode, "### Inbox", NodeType.INBOX.s());
        if (userInbox == null)
            return;

        /*
         * First look to see if there is a target node already existing in this persons
         * inbox that points to the node in question
         */
        SubNode inboxNode = read.findSubNodeByProp(session, userInbox.getPath(), NodeProp.ACT_PUB_ID.s(), id);

        /*
         * If there's no notification for this node already in the user's inbox then add
         * one
         */
        if (inboxNode == null) {
            inboxNode = create.createNode(session, userInbox, null, NodeType.INBOX_ENTRY.s(), 0L,
                    CreateNodeLocation.FIRST, null);

            inboxNode.setOwner(userInbox.getOwner());
            // todo-0: need a new node prop type that is just 'html' and tells us to render
            // content as raw html if set, or for now
            // we could be clever and just detect if it DOES have tags and does NOT have
            // '```'
            inboxNode.setContent(contentHtml);
            inboxNode.setModifyTime(published);
            inboxNode.setProp(NodeProp.ACT_PUB_ID.s(), id);
            inboxNode.setProp(NodeProp.ACT_PUB_OBJ_URL.s(), objUrl);
            inboxNode.setProp(NodeProp.ACT_PUB_OBJ_ATTRIBUTED_TO.s(), objAttributedTo);
            update.save(session, inboxNode);

            String toUserName = getLongUserNameFromActorUrl(objAttributedTo);

            userFeedService.sendServerPushInfo(localUserName,
                    new InboxPushInfo("apReply", inboxNode.getId().toHexString(), contentHtml, toUserName));
        }
    }

    public String getLongUserNameFromActorUrl(String actorUrl) {
        APObj actor = getActor(actorUrl);
        log.debug("getLongUserNameFromActorUrl: " + actorUrl + "\n" + XString.prettyPrint(actor));

        String shortUserName = actor.getStr("preferredUsername"); // short name like 'alice'
        String inbox = actor.getStr("inbox");
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

    /*
     * we know our own actor layout is this: https://ourserver.com/ap/u/userName, so
     * this method just strips the user name by taking what's after the rightmost
     * slash
     */
    public String getLocalUserNameFromActorUrl(String actorUrl) {
        int lastIdx = actorUrl.lastIndexOf("/");
        String ret = null;
        if (lastIdx == -1) {
            log.debug("unable to get a user name from actor url: " + actorUrl);
            return null;
        }

        ret = actorUrl.substring(lastIdx + 1);
        return ret;
    }

    public APObj processFollowAction(APObj followAction) {

        // Actor URL of actor doing the following
        String followerActor = followAction.getStr("actor");
        if (followerActor == null) {
            log.debug("no 'actor' found on follows action request posted object");
            return null;
        }

        // Actor being followed (local to our server)
        String actorUrl = followAction.getStr("object");
        if (actorUrl == null) {
            log.debug("no 'object' found on follows action request posted object");
            return null;
        }

        /*
         * Not sure if this is the best way to convert one of our own actor URL into the
         * username, but unless paths change this should work
         */
        int lastIdx = actorUrl.lastIndexOf("/");
        String userToFollow = null;
        if (lastIdx == -1) {
            log.debug("unable to get a user name from actor url: " + actorUrl);
            return null;
        }

        userToFollow = actorUrl.substring(lastIdx + 1);
        final String _userToFollow = userToFollow;

        APObj _ret = (APObj) adminRunner.run(session -> {
            SubNode followersListNode = read.getUserNodeByType(session, _userToFollow, null, null,
                    NodeType.FOLLOWERS_LIST.s());

            Iterable<SubNode> followers = read.searchSubGraph(session, followersListNode,
                    NodeProp.ACT_PUB_ACTOR_URL.s(), followerActor, null, 0, false, true);

            if (followers == null || !followers.iterator().hasNext()) {
                SubNode followerNode = create.createNode(session, followersListNode.getPath() + "/?",
                        NodeType.FRIEND.s());
                followerNode.setProp(NodeProp.ACT_PUB_USER_URL.s(), followerActor);
                update.save(session, followerNode);
            }

            APObj ret = new APObj() //
                    .put("@context", "https://www.w3.org/ns/activitystreams") //
                    .put("summary", "Accepted follow request") //
                    .put("type", "Accept") //
                    .put("actor", actorUrl) //
                    .put("object", new APObj() //
                            .put("type", "Follow") //
                            .put("actor", followerActor) //
                            .put("object", actorUrl) //
            );
            log.debug("Reply to Follow Request: " + XString.prettyPrint(ret));
            return ret;
        });
        return _ret;
    }

    public APObj generateDummyOrderedCollection(String userName, String path) {
        String host = appProp.protocolHostAndPort();
        APObj obj = new APObj();
        obj.put("@context", "https://www.w3.org/ns/activitystreams");
        obj.put("id", host + path);
        obj.put("type", "OrderedCollection");
        obj.put("totalItems", 0);
        return obj;
    }

    public APObj generateOutbox(String userName) {
        String url = appProp.protocolHostAndPort() + "/ap/outbox/" + userName;
        Long totalItems = getOutboxItemCount(userName);

        return new APObj() //
                .put("@context", "https://www.w3.org/ns/activitystreams") //
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
                SubNode userFeedNode = read.getUserNodeByType(mongoSession, null, userNode, "### Posts",
                        NodeType.USER_FEED.s());

                count = read.getChildCount(mongoSession, userFeedNode);
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
        String url = appProp.protocolHostAndPort() + "/ap/outbox/" + userName + "?min_id=" + minId + "&page=true";

        return new APObj() //
                .put("@context", "https://www.w3.org/ns/activitystreams") //
                .put("id", url) //
                .put("type", "OrderedCollectionPage") //
                .put("orderedItems", items) //

                // todo-0: is this to spec? does Mastodon generate this ? AND which total is it,
                // this page or all pages total ?
                .put("totalItems", items.size());
    }

    /* Generates an Actor object for one of our own local users */
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
                String avatarUrl = appProp.protocolHostAndPort() + "/mobile/api/bin/avatar" + "?nodeId="
                        + userNode.getId().toHexString() + "&v=" + avatarVer;

                String headerImageMime = userNode.getStrProp(NodeProp.BIN_MIME.s() + "Header");
                String headerImageVer = userNode.getStrProp(NodeProp.BIN.s() + "Header");
                String headerImageUrl = appProp.protocolHostAndPort() + "/mobile/api/bin/profileHeader" + "?nodeId="
                        + userNode.getId().toHexString() + "&v=" + headerImageVer;

                APObj actor = new APObj();

                actor.put("@context", new APList() //
                        .val("https://www.w3.org/ns/activitystreams") //
                        .val("https://w3id.org/security/v1"));

                /*
                 * Note: this is a self-reference, and must be identical to the URL that returns
                 * this object
                 */
                actor.put("id", host + "/ap/u/" + userName);
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
                actor.put("inbox", host + "/ap/inbox/" + userName); //
                actor.put("outbox", host + "/ap/outbox/" + userName); //
                actor.put("followers", host + "/ap/followers/" + userName);
                actor.put("following", host + "/ap/following/" + userName);

                /*
                 * This "/u/[user]/home" url format access the node the user has named 'home'.
                 * This node is auto-created if not found, and will also be public (readable) to
                 * all users because any node named 'home' is automatically madd public
                 */
                actor.put("url", host + "/u/" + userName + "/home");

                actor.put("endpoints", new APObj().put("sharedInbox", host + "/ap/inbox"));

                actor.put("publicKey", new APObj() //
                        .put("id", actor.getStr("id") + "#main-key") //
                        .put("owner", actor.getStr("id")) //
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

    public Map<String, Object> getLinkByRel(APObj webFinger, String rel) {
        if (webFinger.getList("links") == null)
            return null;

        for (Object link : webFinger.getList("links")) {
            Map<String, Object> map = (Map<String, Object>) link;
            if (rel.equals(map.get("rel"))) {
                return (Map<String, Object>) link;
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
                SubNode userFeedNode = read.getUserNodeByType(mongoSession, null, userNode, "### Posts",
                        NodeType.USER_FEED.s());

                // long childCount = read.getChildCount(mongoSession, userFeedNode);

                int MAX_PER_PAGE = 3;
                boolean collecting = false;

                if (minId == null) {
                    collecting = true;
                }

                for (SubNode child : read.getChildren(mongoSession, userFeedNode,
                        Sort.by(Sort.Direction.DESC, SubNode.FIELD_CREATE_TIME), null, 0)) {

                    if (items.size() >= MAX_PER_PAGE) {
                        // ocPage.setPrev(outboxBase + "?page=" + String.valueOf(pgNo - 1));
                        // ocPage.setNext(outboxBase + "?page=" + String.valueOf(pgNo + 1));
                        break;
                    }

                    if (collecting) {
                        String hexId = child.getId().toHexString();
                        String published = DateUtil.isoStringFromDate(child.getModifyTime());
                        String actor = host + "/ap/u/" + userName;
                        // APObj item = new APObj();
                        // item.put("type", "Note");
                        // item.put("name", "node:" + hexId);
                        // item.put("id", nodeIdBase + hexId);
                        // item.put("content", child.getContent());
                        // item.put("attributedTo", attributedTo);
                        items.add(new APObj() //
                                .put("id", nodeIdBase + hexId + "&create=t") //
                                .put("type", "Create") //
                                .put("actor", actor) //
                                .put("published", published) //
                                .put("to", new APList().val("https://www.w3.org/ns/activitystreams#Public")) //
                                // todo-0: pending implement followers
                                // .put("cc", new APList().val(host + "/ap/followers/" + userName)) //
                                .put("object", new APObj() //
                                        .put("id", nodeIdBase + hexId) //
                                        .put("type", "Note") //
                                        .put("summary", null) //
                                        .put("replyTo", null) //
                                        .put("published", published) //
                                        .put("url", nodeIdBase + hexId) //
                                        .put("attributedTo", actor) //
                                        .put("to", new APList().val("https://www.w3.org/ns/activitystreams#Public")) //
                                        // todo-0: pending implement followers
                                        // .put("cc", new APList().val(host + "/ap/followers/" + userName)) //
                                        .put("sensitive", false) //
                                        .put("content", child.getContent())//
                        ) //
                        );
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
