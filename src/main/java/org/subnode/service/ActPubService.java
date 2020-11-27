package org.subnode.service;

import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.Signature;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.text.SimpleDateFormat;
import java.util.Base64;
import java.util.Date;
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
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.subnode.actpub.APObj;
import org.subnode.actpub.ActPubFactory;
import org.subnode.actpub.VisitAPObj;
import org.subnode.config.AppProp;
import org.subnode.model.client.NodeProp;
import org.subnode.model.client.NodeType;
import org.subnode.mongo.MongoCreate;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.MongoUpdate;
import org.subnode.mongo.MongoUtil;
import org.subnode.mongo.model.SubNode;
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
    private ActPubFactory apFactory;

    @Autowired
    private AppProp appProp;

    /*
     * RestTempalte is thread-safe and reusable, and has no state, so we need only
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

    public void sendNote(String privateKey, String toInbox, String fromUser, String inReplyTo, String content,
            String toActor) {
        String actor = appProp.protocolHostAndPort() + "/ap/u/" + fromUser;

        APObj message = apFactory.newCreateMessageForNote(actor, inReplyTo, content, toActor);
        String body = XString.prettyPrint(message);
        byte[] bodyBytes = body.getBytes(StandardCharsets.UTF_8);
        log.debug("Sending Message: " + body);

        byte[] privKeyBytes = Base64.getDecoder().decode(privateKey);
        // byte[] publicKeyBytes = Base64.getDecoder().decode(publicKey);
        PrivateKey privKey = null;
        // PublicKey pubKey = null;

        try {
            KeyFactory kf = KeyFactory.getInstance("RSA");

            PKCS8EncodedKeySpec keySpecPKCS8 = new PKCS8EncodedKeySpec(privKeyBytes);
            privKey = kf.generatePrivate(keySpecPKCS8);

            // X509EncodedKeySpec keySpecX509 = new X509EncodedKeySpec(publicKeyBytes);
            // pubKey = (RSAPublicKey) kf.generatePublic(keySpecX509);
        } catch (Exception e) {
            log.error("RSA Key Parsing failed", e);
            return;
        }

        SimpleDateFormat dateFormat = new SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss z", Locale.US);
        dateFormat.setTimeZone(TimeZone.getTimeZone("GMT"));
        String date = dateFormat.format(new Date());

        String digestHeader = "SHA-256=";
        try {
            digestHeader += Base64.getEncoder().encodeToString(MessageDigest.getInstance("SHA-256").digest(bodyBytes));
        } catch (Exception ex) {
            throw new RuntimeException(ex);
        }

        URL url = null;
        try {
            url = new URL(toInbox);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }

        String host = url.getHost();
        String path = url.getPath();

        String strToSign = "(request-target): post " + path + "\nhost: " + host + "\ndate: " + date + "\ndigest: "
                + digestHeader;

        Signature sig;
        byte[] signature;
        try {
            sig = Signature.getInstance("SHA256withRSA");
            sig.initSign(privKey);
            sig.update(strToSign.getBytes(StandardCharsets.UTF_8));
            signature = sig.sign();
        } catch (Exception e) {
            log.error("Signature creation failed", e);
            throw new RuntimeException(e);
        }

        String keyID = actor + "#main-key";
        String headerSig = "keyId=\"" + keyID + "\",headers=\"(request-target) host date digest\",signature=\""
                + Base64.getEncoder().encodeToString(signature) + "\"";

        postJson(toInbox, host, date, headerSig, digestHeader, bodyBytes);
    }

    /*
     * Reads in a user from the Fediverse with a name like: someuser@fosstodon.org
     */
    public void loadForeignUser(MongoSession session, String apUserName, SubNode friendNode) {
        String host = getHostFromUserName(apUserName);
        log.debug("Host of username: [" + host + "]");
        APObj webFinger = getWebFinger("https://" + host, apUserName);

        Map<String, Object> self = getLinkByRel(webFinger, "self");
        log.debug("Self Link: " + XString.prettyPrint(self));
        if (self != null) {
            APObj actor = getActor((String) self.get("href"));

            // if webfinger was successful, ensure the user is imported into our system.
            if (actor != null) {
                importActor(session, apUserName, actor, friendNode);
            }
        }
    }

    /*
     * todo-0: need to disallow '@' symbol at least in our signup dialog, although
     * techncally the DB will allow it and it will reference other foreign servers
     * only
     * 
     * todo-0: I think 'friendNode' shouldn't be involved with this method at all.
     */
    public void importActor(MongoSession session, String apUserName, APObj actor, SubNode friendNode) {
        if (apUserName == null)
            return;

        SubNode userNode = read.getUserNodeByUserName(session, apUserName);

        // If we don't have this user in our system, create them. (todo-0: Need to
        // specifically avoid any users
        // here that somehow contain "@ourserver". That would basically duplicate a
        // user.)
        if (userNode == null) {
            userNode = util.createUser(session, apUserName, null, null, true);
        }

        /*
         * todo-0: setting properties on userNode here needs to detect if we changed the
         * prop, and then only call update.save() if the node HAS changed. Do it by
         * making setProp return boolean if changed.
         */

        /* Update user icon */
        APObj icon = actor.getAPObj("icon");
        if (icon != null) {
            String iconUrl = icon.getStr("url");
            if (iconUrl != null) {
                String curIconUrl = userNode.getStringProp(NodeProp.ACT_PUB_USER_ICON_URL.s());
                if (!iconUrl.equals(curIconUrl)) {
                    userNode.setProp(NodeProp.ACT_PUB_USER_ICON_URL.s(), iconUrl);
                    update.save(session, userNode, false);
                }
                /*
                 * Note: we also replicate some of the user info onto the friendNode, so that it
                 * can render rapidly with no queries onto other nodes
                 */
                if (friendNode != null) {
                    friendNode.setProp(NodeProp.ACT_PUB_USER_ICON_URL.s(), iconUrl);
                }
            }
        }

        String actorUrl = actor.getStr("id");
        userNode.setProp(NodeProp.ACT_PUB_ACTOR_URL.s(), actorUrl);

        String actorInbox = actor.getStr("inbox");
        userNode.setProp(NodeProp.ACT_PUB_ACTOR_INBOX.s(), actorInbox);

        update.save(session, userNode, false);

        if (friendNode != null) {
            String userUrl = actor.getStr("url");
            if (userUrl != null) {
                friendNode.setProp(NodeProp.ACT_PUB_USER_URL.s(), userUrl);
            }
        }

        final SubNode _userNode = userNode;
        SubNode feedNode = read.getUserNodeByType(session, apUserName, null, null, NodeType.USER_FEED.s());
        Iterable<SubNode> feedItems = read.getSubGraph(session, feedNode);

        /*
         * Generate a list of known AP IDs so we can ignore them and load only the
         * unknown ones from the foreign server
         */
        HashSet<String> apIdSet = new HashSet<String>();
        for (SubNode n : feedItems) {
            String apId = n.getStringProp(NodeProp.ACT_PUB_ID.s());
            if (apId != null) {
                apIdSet.add(apId);
            }
        }

        // todo-0: add error reporting here.
        APObj outbox = getOutbox(actor.getStr("outbox"));
        if (outbox == null)
            return;

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
                    saveOutboxItem(session, feedNode, apObj, _pageNo, _userNode.getId());
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

        // Now process last page. No guarantee we already encountered it ? Need to
        // verify this IS needed.
        ocPage = getOrderedCollectionPage(outbox.getStr("last"));
        if (ocPage != null) {
            Object orderedItems = ocPage.getList("orderedItems");
            iterate(orderedItems, apObj -> {
                String apId = apObj.getStr("id");
                if (!apIdSet.contains(apId)) {
                    log.debug("CREATING NODE (AP Obj): " + apId);
                    saveOutboxItem(session, feedNode, apObj, -1, _userNode.getId());
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

    public APObj getActor(String url) {
        if (url == null)
            return null;
        APObj actor = getJson(url, new MediaType("application", "ld+json"));
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

                        APObj webFinger = new APObj();
                        webFinger.put("subject", "acct:" + username + "@" + appProp.getMetaHost());

                        APObj webFingerLink = new APObj();
                        webFingerLink.put("rel", "self");
                        webFingerLink.put("type", "application/activity+json");

                        // The href here is required to be the link to the "actor document"
                        webFingerLink.put("href", host + "/ap/u/" + username);

                        List<APObj> links = new LinkedList<APObj>();
                        links.add(webFingerLink);
                        webFinger.put("links", links);

                        log.debug("Reply with WebFinger: " + XString.prettyPrint(webFinger));
                        return webFinger;
                    }
                }
            }
        } catch (Exception e) {
            log.error("webfinger failed", e);
        }
        return null;
    }

    public APObj generateActor(String userName) {
        String host = appProp.protocolHostAndPort();

        try {
            SubNode userNode = read.getUserNodeByUserName(null, userName);
            if (userNode != null) {
                String publicKey = userNode.getStringProp(NodeProp.CRYPTO_KEY_PUBLIC.s());
                if (publicKey == null) {
                    throw new RuntimeException("User has no crypto keys. This means they have never logged in?");
                }

                APObj actor = new APObj();

                List<Object> context = new LinkedList<Object>();
                context.add("https://www.w3.org/ns/activitystreams");
                context.add("https://w3id.org/security/v1");
                actor.put("@context", context);

                // Note: this is a self-reference, and must be identical to the @RequestMapping
                // // on this function (above)
                actor.put("id", host + "/ap/u/" + userName);
                actor.put("type", "Person");
                actor.put("preferredUsername", userName);
                actor.put("name", userName); // this should be ordinary name (first last)
                actor.put("inbox", host + "/ap/inbox/" + userName); //
                actor.put("outbox", host + "/ap/outbox/" + userName); //
                actor.put("followers", host + "/ap/followers/" + userName);
                actor.put("following", host + "/ap/following/" + userName);
                actor.put("url", host + "/ap/user/" + userName);

                APObj endpoints = new APObj();
                endpoints.put("sharedInbox", host + "/ap/inbox");
                actor.put("endpoints", endpoints);

                APObj pubKey = new APObj();
                pubKey.put("id", actor.getStr("id") + "#main-key");
                pubKey.put("owner", actor.getStr("id"));
                pubKey.put("publicKeyPem", "-----BEGIN PUBLIC KEY-----\n" + publicKey + "\n-----END PUBLIC KEY-----\n");
                actor.put("publicKey", pubKey); //
                actor.put("supportsFriendRequests", true);

                log.debug("Reply with Actor: " + XString.prettyPrint(actor));
                return actor;
            }
        } catch (Exception e) {
            log.error("actor query failed", e);
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
            HttpHeaders headers = new HttpHeaders();
            // List<MediaType> acceptableMediaTypes = new LinkedList<MediaType>();
            // acceptableMediaTypes.add(mediaType);
            // headers.setAccept(acceptableMediaTypes);
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

            // ret = mapper.readValue(response.getBody(), new TypeReference<APObj>() {
            // });
            // log.debug("REQ: " + url + "\nRES: " + XString.prettyPrint(ret));
        } catch (Exception e) {
            log.error("postJson failed: " + url, e);
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
        }
        return ret;
    }

    // * /* WARNING: This is old code never completed yet and just the beginnings of
    // * some experimenting with an outbox
    // */
    // public Object getOutbox(String userName, String page) {
    // String host = "https://" + appProp.getMetaHost();
    // ValContainer<Object> ret = new ValContainer<Object>();

    // String outboxBase = host + "/ap/outbox/" + userName;

    // // temp hack (todo-1)
    // String nodeIdBase = "https://quantizr.com/app?id=";

    // // resp.header("Access-Control-Allow-Origin", "*");
    // try {
    // SubNode userNode = read.getUserNodeByUserName(null, userName);
    // if (userNode != null) {

    // adminRunnerEx.run(mongoSession -> {
    // SubNode userFeedNode = read.getUserNodeByType(mongoSession, null, userNode,
    // "### Posts",
    // NodeType.USER_FEED.s());

    // long childCount = read.getChildCount(mongoSession, userFeedNode);

    // ////////
    // List<ActPubOutboxItem> items = new LinkedList<ActPubOutboxItem>();

    // int MAX_PER_PAGE = 3;
    // String attributedTo = host + "/ap/u/" + userName;
    // int counter = 0;
    // boolean collecting = false;
    // boolean getLastPage = false;
    // int pgNo = 0;
    // int startingCounter = 0;

    // if ("last".equals(page)) {
    // getLastPage = true;
    // } else {
    // // pgNo is not zero offset. Starts at '1'
    // try {
    // pgNo = Integer.valueOf(page);
    // } catch (Exception e) {
    // }

    // if (pgNo < 0) {
    // pgNo = 0;
    // }
    // startingCounter = (pgNo - 1) * MAX_PER_PAGE;
    // }

    // for (SubNode child : read.getChildren(mongoSession, userFeedNode,
    // Sort.by(Sort.Direction.DESC, SubNode.FIELD_CREATE_TIME), null, 0)) {

    // if (items.size() >= MAX_PER_PAGE) {
    // // ocPage.setPrev(outboxBase + "?page=" + String.valueOf(pgNo - 1));
    // // ocPage.setNext(outboxBase + "?page=" + String.valueOf(pgNo + 1));
    // break;
    // }

    // if (counter >= startingCounter) {
    // collecting = true;
    // }

    // if (collecting) {
    // String hexId = child.getId().toHexString();
    // ActPubOutboxItem item = new ActPubOutboxItem();
    // item.setType("Note");
    // item.setName("node:" + hexId);
    // item.setId(nodeIdBase + hexId);
    // item.setContent(child.getContent());
    // item.setAttributedTo(attributedTo);
    // items.add(item);
    // }

    // if (!collecting && getLastPage && counter >= childCount - MAX_PER_PAGE) {
    // collecting = true;
    // }

    // counter++;
    // }
    // ////////

    // if (page == null) {
    // ActPubOutbox outbox = new ActPubOutbox();
    // ret.setVal(outbox);

    // outbox.setOrderedItems(items);
    // outbox.setPartOf(outboxBase);

    // outbox.setId(host + "/ap/outbox/" + userName);

    // outbox.setTotalItems((int) childCount);
    // outbox.setFirst(outboxBase + "?page=true");
    // outbox.setLast(outboxBase + "?min_id=0&page=true");
    // } else {
    // OrderedCollectionPage ocPage = new OrderedCollectionPage();
    // ret.setVal(ocPage);
    // ocPage.setOrderedItems(items);

    // // defaul to these values.
    // ocPage.setPrev(outboxBase + "?page=true");
    // ocPage.setNext(outboxBase + "?page=true");

    // ocPage.setId(outboxBase + "?page=" + page);
    // ocPage.setPartOf(outboxBase);

    // // List<ActPubOutboxItem> items = new LinkedList<ActPubOutboxItem>();
    // // ocPage.setOrderedItems(items);

    // // int MAX_PER_PAGE = 3;
    // // String attributedTo = host + "/ap/u/" + userName;
    // // int counter = 0;
    // // boolean collecting = false;
    // // boolean getLastPage = false;
    // // int pgNo = 0;
    // // int startingCounter = 0;

    // // if (page.equals("last")) {
    // // getLastPage = true;
    // // } else {
    // // // pgNo is not zero offset. Starts at '1'
    // // pgNo = Integer.valueOf(page);
    // // if (pgNo < 0) {
    // // pgNo = 0;
    // // }
    // // startingCounter = (pgNo - 1) * MAX_PER_PAGE;
    // // }
    // }

    // log.debug("Reply with Outbox: " + XString.prettyPrint(ret.getVal()));
    // return ret.getVal();
    // });
    // }
    // } catch (Exception e) {
    // // todo-0
    // }
    // return null;
    // }
}
