package org.subnode.service;

import java.util.LinkedList;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.apache.commons.lang3.StringUtils;
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
import org.subnode.config.AppProp;
import org.subnode.model.client.NodeProp;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.RunAsMongoAdminEx;
import org.subnode.mongo.model.SubNode;
import org.subnode.util.Util;
import org.subnode.util.XString;

@Component
public class ActPubService {
    private static final Logger log = LoggerFactory.getLogger(ActPubService.class);

    @Autowired
    private MongoRead read;

    @Autowired
    private AppProp appProp;

    @Autowired
    private RunAsMongoAdminEx<Object> adminRunnerEx;

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

    // https://fosstodon.org/.well-known/webfinger?resource=acct:WClayFerguson@fosstodon.org'

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

        // resp.header("Access-Control-Allow-Origin", "*");
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
                actor.put("context", context);

                // Note: this is a self-reference, and must be identical to the @RequestMapping
                // // on this function (above)
                actor.put("id", host + "/ap/u/" + userName);
                actor.put("type", "Person");
                actor.put("preferredUsername", userName);
                actor.put("inbox", host + "/ap/inbox/" + userName); //
                actor.put("outbox", host + "/ap/outbox/" + userName); //
                //actor.setFollowers("followers", host + "/ap/followers/" + userName);

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
