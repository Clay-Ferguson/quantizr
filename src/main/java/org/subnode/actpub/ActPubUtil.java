package org.subnode.actpub;

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
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;
import org.subnode.actpub.model.AP;
import org.subnode.actpub.model.APList;
import org.subnode.actpub.model.APObj;
import org.subnode.actpub.model.APProp;
import org.subnode.model.client.NodeProp;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.service.ServiceBase;
import org.subnode.util.Util;
import org.subnode.util.XString;
import static org.subnode.util.Util.*;

@Component
public class ActPubUtil extends ServiceBase {
    private static final Logger log = LoggerFactory.getLogger(ActPubUtil.class);

    /*
     * RestTemplate is thread-safe and reusable, and has no state, so we need only one final static
     * instance ever
     */
    private static final RestTemplate restTemplate = new RestTemplate(Util.getClientHttpRequestFactory(10000));
    private static final ObjectMapper mapper = new ObjectMapper();

    // NOTE: This didn't allow unknown properties as expected but putting the
    // following in the JSON classes did:
    // @JsonIgnoreProperties(ignoreUnknown = true)
    {
        mapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
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

    /* Builds an actor url for a LOCAL userName */
    public String makeActorUrlForUserName(String userName) {
        return prop.getProtocolHostAndPort() + APConst.ACTOR_PATH + "/" + userName;
    }

    /*
     * Builds the unique set of hosts from a list of userNames (not used currently)
     * 
     * Looks like this isn't being used.
     */
    public HashSet<String> getHostsFromUserNames(List<String> userNames) {
        String host = prop.getMetaHost();
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

    public String getActorUrlFromWebFingerObj(Object webFinger) {
        if (no(webFinger))
            return null;
        Object self = getLinkByRel(webFinger, "self");
        // log.debug("Self Link: " + XString.prettyPrint(self));

        String actorUrl = null;
        if (ok(self)) {
            actorUrl = AP.str(self, APProp.href);
        }
        return actorUrl;
    }

    /*
     * Searches thru the 'links' array property on webFinger and returns the links array object that has
     * a 'rel' property that matches the value in the rel param string
     */
    public Object getLinkByRel(Object webFinger, String rel) {
        List<?> linksList = AP.list(webFinger, APProp.links);

        if (no(linksList))
            return null;

        for (Object link : linksList) {
            if (rel.equals(AP.str(link, APProp.rel))) {
                return link;
            }
        }
        return null;
    }

    public APObj getJson(String url, MediaType mediaType) {
        return getJson(url, mediaType, 0);
    }

    /**
     * 
     * @param url
     * @param mediaType
     * @param waitSeconds Number of seconds to wait for server to come online before giving up
     * @return
     */
    public APObj getJson(String url, MediaType mediaType, int waitSeconds) {
        // log.debug("getJson: " + url);
        APObj ret = null;
        try {
            while (true) {
                try {
                    HttpHeaders headers = new HttpHeaders();

                    if (ok(mediaType)) {
                        List<MediaType> acceptableMediaTypes = new LinkedList<>();
                        acceptableMediaTypes.add(mediaType);
                        headers.setAccept(acceptableMediaTypes);
                    }

                    MultiValueMap<String, Object> bodyMap = new LinkedMultiValueMap<>();
                    HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(bodyMap, headers);
                    ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, requestEntity, String.class);
                    ret = mapper.readValue(response.getBody(), new TypeReference<>() {});
                    // log.debug("REQ: " + url + "\nRES: " + XString.prettyPrint(ret));
                    break;
                }
                /*
                 * in case we are in a multi-peer setup some other peers may not be started so we tolerate that
                 * scenario by sleeping and looping for 10 retries.
                 */
                catch (ResourceAccessException re) {
                    if (waitSeconds-- > 0) {
                        log.debug("Waiting for url: " + url);
                        Thread.sleep(1000);
                    } else {
                        throw re;
                    }
                }
            }
        } catch (Exception e) {
            /*
             * todo-1: Actually it would be better to put this entire string being logged here into a hashset to
             * just keep a unique list, and not even log it here, but make it part of the 'systemInfo' available
             * under the admin menu for checking server status info.
             */
            log.debug("failed getting json: " + url + " -> " + e.getMessage());
            // throw new RuntimeException(e);
            return null;
        }
        return ret;
    }

    /*
     * Note: 'actor' here is the actor URL of the local (non-federated) user doing the post
     * 
     * WARNING: If privateKey is passed as 'null' you MUST be calling this from HTTP request thread.
     */
    public void securePost(String userDoingPost, MongoSession ms, String privateKey, String toInbox, String actor, APObj message,
            MediaType acceptType) {
        try {
            apUtil.log("Secure post to " + toInbox);
            /* if private key not sent then get it using the session */
            if (no(privateKey)) {
                privateKey = apCrypto.getPrivateKey(ms, userDoingPost);
            }

            if (no(privateKey)) {
                throw new RuntimeException("Unable to get provate key for user sending message.");
            }

            String body = XString.prettyPrint(message);
            byte[] bodyBytes = body.getBytes(StandardCharsets.UTF_8);
            apUtil.log("Posting Object:\n" + body);

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

            // WARNING: dateFormat is NOT threasafe. Always create one here.
            SimpleDateFormat dateFormat = new SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss z", Locale.US);
            dateFormat.setTimeZone(TimeZone.getTimeZone("GMT"));
            String date = dateFormat.format(new Date());

            String digestHeader =
                    "SHA-256=" + Base64.getEncoder().encodeToString(MessageDigest.getInstance("SHA-256").digest(bodyBytes));

            URL url = new URL(toInbox);
            // log.debug("secure post to host: " + url.getHost());
            String strToSign = "(request-target): post " + url.getPath() + "\nhost: " + url.getHost() + "\ndate: " + date
                    + "\ndigest: " + digestHeader;

            Signature sig = Signature.getInstance("SHA256withRSA");
            sig.initSign(privKey);
            sig.update(strToSign.getBytes(StandardCharsets.UTF_8));
            byte[] signature = sig.sign();

            String headerSig = "keyId=\"" + actor + "#main-key" + "\",headers=\"(request-target) host date digest\",signature=\""
                    + Base64.getEncoder().encodeToString(signature) + "\"";

            postJson(toInbox, url.getHost(), date, headerSig, digestHeader, body, acceptType);
        } catch (Exception e) {
            log.error("secure http post failed", e);
            throw new RuntimeException(e);
        }
    }

    /*
     * Effeciently gets the Actor by using a cache to ensure we never get the same Actor twice until the
     * app restarts at least, o
     */
    public APObj getActorByUrl(String url) {
        if (no(url))
            return null;

        apub.saveFediverseName(url);

        // first try to return from cache.
        APObj actor = apCache.actorsByUrl.get(url);
        if (ok(actor)) {
            return actor;
        }

        try {
            actor = getJson(url, APConst.MTYPE_ACT_JSON);

            if (ok(actor)) {
                String userName = getLongUserNameFromActor(actor);
                apCache.actorsByUrl.put(url, actor);
                apCache.actorsByUserName.put(userName, actor);
            }
        } catch (Exception e) {
            // todo-1: eating this for now.
        }
        // log.debug("Actor: " + XString.prettyPrint(actor));
        return actor;
    }

    public String getActorUrlFromUserName(String userName) {
        String actorUrl = null;

        MongoSession as = auth.getAdminSession();
        SubNode userNode = apub.getAcctNodeByUserName(as, userName);
        if (ok(userNode)) {
            actorUrl = userNode.getStr(NodeProp.ACT_PUB_ACTOR_ID.s());
        }

        // DO NOT DELETE: this is the other way to get the actorUrl without reading or creating the user
        // in our DB but we're not doing this.
        // String actorUrl = null;
        // APObj webFinger = apUtil.getWebFinger(userName);
        // if (ok(webFinger )) {
        // actorUrl = apUtil.getActorUrlFromWebFingerObj(webFinger);
        // }
        return actorUrl;
    }

    /*
     * https://server.org/.well-known/webfinger?resource=acct:someuser@server.org
     * 
     * Get WebFinger from foreign server
     * 
     * 'resource' examples:
     * 
     * someuser@server.org (normal Fediverse, no port)
     * 
     * someuser@ip:port (special testing mode, insecure)
     */
    public APObj getWebFinger(String resource) {
        apub.saveFediverseName(resource);

        return getWebFingerSec(resource, true);
        // need to re-enable this again if we plan on doing localhost fediverse testing (todo-1)
        // // For non-secure domains, they're required to have a port in their name,
        // // so this is users like bob@q1:8184 (for example), and that port is expected
        // // also to NOT be https 443 port.
        // if (resource.contains(":")) {
        // return getWebFingerSec(resource, false);
        // }

        // try {
        // return getWebFingerSec(resource, true);
        // } catch (Exception e) {
        // return getWebFingerSec(resource, false);
        // }
    }

    /**
     * Sec suffix means 'security' option (https vs http)
     */
    public APObj getWebFingerSec(String userName, boolean secure) {
        if (userName.startsWith("@")) {
            userName = userName.substring(1);
        }
        String host = (secure ? "https://" : "http://") + getHostFromUserName(userName);

        Boolean failed = apCache.webFingerFailsByUserName.get(userName);
        if (ok(failed)) {
            return null;
        }

        // return from cache if we have this cached
        APObj finger = apCache.webFingerCacheByUserName.get(userName);
        if (ok(finger)) {
            return finger;
        }

        String url = host + APConst.PATH_WEBFINGER + "?resource=acct:" + userName;
        finger = getJson(url, APConst.MTYPE_JRD_JSON);

        if (ok(finger)) {
            // log.debug("Caching WebFinger: " + XString.prettyPrint(finger));
            apCache.webFingerCacheByUserName.put(userName, finger);
        } else {
            apCache.webFingerFailsByUserName.put(userName, true);
        }
        return finger;
    }

    public APObj postJson(String url, String headerHost, String headerDate, String headerSig, String digestHeader, String body,
            MediaType acceptType) {
        APObj ret = null;
        try {
            // log.debug("postJson to: " + url);

            HttpHeaders headers = new HttpHeaders();
            if (ok(acceptType)) {
                List<MediaType> acceptableMediaTypes = new LinkedList<>();
                acceptableMediaTypes.add(acceptType);
                headers.setAccept(acceptableMediaTypes);
            }

            if (ok(headerHost)) {
                headers.add("Host", headerHost);
            }

            if (ok(headerDate)) {
                headers.add("Date", headerDate);
            }

            if (ok(headerSig)) {
                headers.add("Signature", headerSig);
            }

            if (ok(digestHeader)) {
                headers.add("Digest", digestHeader);
            }

            // HttpEntity<byte[]> requestEntity = new HttpEntity<>(bodyBytes, headers);
            HttpEntity<String> requestEntity = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, requestEntity, String.class);
            log.debug("POST TO: " + url + " RESULT: " + response.getStatusCode() + " response=" + response.getBody());
        } catch (Exception e) {
            log.error("postJson failed: " + url, e);
            throw new RuntimeException(e);
        }
        return ret;
    }

    /*
     * Generate webfinger response from our server
     */
    public APObj generateWebFinger(String resource) {
        try {
            if (StringUtils.isNotEmpty(resource) && resource.startsWith("acct:")) {
                // split into username and host parts
                String[] parts = resource.substring(5).split("@", 2);

                if (parts.length == 2) {
                    String fullHost = parts[1];

                    // strip the port number off if exists
                    String host = XString.truncateAfterFirst(fullHost, ":");

                    if (host.equals(prop.getMetaHost())) {
                        String username = parts[0];

                        SubNode userNode = read.getUserNodeByUserName(null, username);
                        if (ok(userNode)) {
                            APObj webFinger = new APObj() //
                                    .put(APProp.subject, "acct:" + username + "@" + fullHost) //
                                    .put(APProp.links, new APList() //
                                            .val(new APObj() //
                                                    .put(APProp.rel, "self") //
                                                    .put(APProp.type, APConst.CTYPE_ACT_JSON) //
                                                    .put(APProp.href, makeActorUrlForUserName(username))));

                            apUtil.log("Reply with WebFinger: " + XString.prettyPrint(webFinger));
                            return webFinger;
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.error("webfinger failed", e);
            throw new RuntimeException(e);
        }
        return null;
    }

    public String getLongUserNameFromActorUrl(String actorUrl) {
        if (no(actorUrl)) {
            return null;
        }

        /*
         * Detect if this actorUrl points to our local server, and get the long name the easy way if so
         */
        if (isLocalActorUrl(actorUrl)) {
            String shortUserName = getLocalUserNameFromActorUrl(actorUrl);
            String longUserName = shortUserName + "@" + prop.getMetaHost();
            return longUserName;
        }

        APObj actor = getActorByUrl(actorUrl);
        if (no(actor)) {
            return null;
        }
        // log.debug("getLongUserNameFromActorUrl: " + actorUrl + "\n" +
        // XString.prettyPrint(actor));
        return getLongUserNameFromActor(actor);
    }

    /**
     * Uses the 'preferredUsername' in the 'actor' object to build the long name of the user like
     * preferredUserName@host.com
     */
    public String getLongUserNameFromActor(Object actor) {
        String shortUserName = AP.str(actor, APProp.preferredUsername); // short name like 'alice'
        String inbox = AP.str(actor, APProp.inbox);
        try {
            URL url = new URL(inbox);
            String host = url.getHost();

            // get port number (normally not set and thus '-1')
            int port = url.getPort();

            /*
             * Be sure the port name is on the long name of non-standard ports. This is hacking the protocol to
             * support our localhost peer-to-peer scenario (servers q1, q2, etc)
             */
            if (port != -1 && port != 80 && port != 443) {
                host += ":" + String.valueOf(port);
            }

            // log.debug("long user name: " + shortUserName + "@" + host);
            return shortUserName + "@" + host;
        } catch (Exception e) {
            log.error("failed building toUserName", e);
        }
        return null;
    }

    public boolean isLocalActorUrl(String actorUrl) {
        return actorUrl.startsWith(prop.getProtocolHostAndPort() + APConst.ACTOR_PATH + "/");
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

    public boolean isPublicAddressed(String address) {
        return address.endsWith("#Public") || address.equals("Public") || address.equals("as:Public");
    }

    public boolean isLocalUrl(String url) {
        return ok(url) && url.startsWith(prop.getHttpProtocol() + "://" + prop.getMetaHost());
    }

    public void iterateOrderedCollection(Object collectionObj, int maxCount, ActPubObserver observer) {
        if (no(collectionObj))
            return;
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
        List<?> orderedItems = AP.list(collectionObj, APProp.orderedItems);
        if (ok(orderedItems)) {
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
        String firstPageUrl = AP.str(collectionObj, APProp.first);
        if (ok(firstPageUrl)) {
            // log.debug("First Page Url: " + firstPageUrl);
            if (++pageQueries > maxPageQueries)
                return;
            Object ocPage = no(firstPageUrl) ? null : getJson(firstPageUrl, APConst.MTYPE_ACT_JSON);

            while (ok(ocPage)) {
                orderedItems = AP.list(ocPage, APProp.orderedItems);
                for (Object apObj : orderedItems) {

                    // if apObj is an object (map)
                    if (AP.hasProps(apObj)) {
                        String apId = AP.str(apObj, APProp.id);
                        // if no apId that's fine, just process item.
                        if (no(apId)) {
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

                String nextPage = AP.str(ocPage, APProp.next);
                if (ok(nextPage)) {
                    if (++pageQueries > maxPageQueries)
                        return;
                    ocPage = no(nextPage) ? null : getJson(nextPage, APConst.MTYPE_ACT_JSON);
                } else {
                    break;
                }
            }
        }

        String lastPageUrl = AP.str(collectionObj, APProp.last);
        if (ok(lastPageUrl)) {
            // log.debug("Last Page Url: " + lastPageUrl);
            if (++pageQueries > maxPageQueries)
                return;
            Object ocPage = no(lastPageUrl) ? null : getJson(lastPageUrl, APConst.MTYPE_ACT_JSON);

            if (ok(ocPage)) {
                orderedItems = AP.list(ocPage, APProp.orderedItems);

                for (Object apObj : orderedItems) {
                    // if apObj is an object (map)
                    if (AP.hasProps(apObj)) {
                        String apId = AP.str(apObj, APProp.id);
                        // if no apId that's fine, just process item.
                        if (no(apId)) {
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

    // see logback-spring.xml!
    public void log(String message) {
        if (prop.isApLog()) {
            log.trace(message);
        }
    }
}
