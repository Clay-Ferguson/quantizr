package org.subnode.actpub;

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
import javax.servlet.http.HttpServletRequest;
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
import org.subnode.config.AppProp;
import org.subnode.model.client.NodeProp;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.service.UserManagerService;
import org.subnode.util.ThreadLocals;
import org.subnode.util.Util;
import org.subnode.util.XString;

@Component
public class ActPubUtil {
    private static final Logger log = LoggerFactory.getLogger(ActPubUtil.class);

    @Autowired
    private AppProp appProp;

    @Autowired
    private MongoRead read;

    @Autowired
    private ActPubCache apCache;

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

    public String makeActorUrlForUserName(String userName) {
        return appProp.getProtocolHostAndPort() + ActPubConstants.ACTOR_PATH + "/" + userName;
    }

    /*
     * Builds the unique set of hosts from a list of userNames (not used currently)
     */
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
            ret = mapper.readValue(response.getBody(), new TypeReference<>() {});
            // log.debug("REQ: " + url + "\nRES: " + XString.prettyPrint(ret));
        } catch (Exception e) {
            /*
             * todo-1: Actually it would be better to put this entire string being logged here into a hashset to
             * just keep a unique list, and not even log it here, but make it part of the 'systemInfo' available
             * under the admin menu for checking server status info.
             */
            log.debug("failed getting json: " + url + " -> " + e.getMessage());
            throw new RuntimeException(e);
        }
        return ret;
    }

    /*
     * Note: 'actor' here is the actor URL of the local (non-federated) user doing the post
     * 
     * WARNING: If privateKey is passed as 'null' you MUST be calling this from HTTP request thread.
     */
    public void securePost(MongoSession session, String privateKey, String toInbox, String actor, APObj message) {
        try {
            /* if private key not sent then get it using the session */
            if (privateKey == null) {
                privateKey = getPrivateKey(session, ThreadLocals.getSessionContext().getUserName());
            }

            String body = XString.prettyPrint(message);
            byte[] bodyBytes = body.getBytes(StandardCharsets.UTF_8);
            // log.debug("Posting to inbox " + toInbox + ":\n" + body);

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
            String strToSign =
                    "(request-target): post " + url.getPath() + "\nhost: " + url.getHost() + "\ndate: " + date + "\ndigest: " + digestHeader;

            Signature sig = Signature.getInstance("SHA256withRSA");
            sig.initSign(privKey);
            sig.update(strToSign.getBytes(StandardCharsets.UTF_8));
            byte[] signature = sig.sign();

            String headerSig = "keyId=\"" + actor + "#main-key" + "\",headers=\"(request-target) host date digest\",signature=\""
                    + Base64.getEncoder().encodeToString(signature) + "\"";

            postJson(toInbox, url.getHost(), date, headerSig, digestHeader, bodyBytes);
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
        if (url == null)
            return null;

        // first try to return from cache.
        APObj actor = apCache.actorsByUrl.get(url);
        if (actor != null) {
            return actor;
        }

        // if not in cache we need to load the actor from the web
        actor = getJson(url, new MediaType("application", "ld+json"));

        if (actor != null) {
            String userName = getLongUserNameFromActor(actor);
            apCache.actorsByUrl.put(url, actor);
            apCache.actorsByUserName.put(userName, actor);
        }

        // log.debug("Actor: " + XString.prettyPrint(actor));
        return actor;
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
        APObj finger = apCache.webFingerCacheByUserName.get(resource);
        if (finger != null) {
            return finger;
        }

        String url = host + ActPubConstants.PATH_WEBFINGER + "?resource=acct:" + resource;
        finger = getJson(url, new MediaType("application", "jrd+json"));

        if (finger != null) {
            // log.debug("Caching WebFinger: " + XString.prettyPrint(finger));
            apCache.webFingerCacheByUserName.put(resource, finger);
        }
        return finger;
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
            // log.debug("Post to " + url + " RESULT: " + response.getStatusCode() + "
            // response=" +
            // response.getBody());
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

    public boolean isLocalActorUrl(String actorUrl) {
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
            // As long as this code path is never needed for Mastodon/Pleroma I'm not going
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

    public boolean isLocalUrl(String url) {
        return url != null && url.startsWith(appProp.getHttpProtocol() + "://" + appProp.getMetaHost());
    }

    /* Gets private RSA key from current user session */
    public String getPrivateKey(MongoSession session, String userName) {
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

    public void iterateOrderedCollection(Object collectionObj, int maxCount, ActPubObserver observer) {
        /*
         * To reduce load for our purposes we can limit to just getting 2 pages of results to update a user,
         * and really just one page would be ideal if not for the fact that some servers return an empty
         * first page and put the results in the 'last' page
         */
        int maxPageQueries = 2;
        int pageQueries = 0;

        // log.debug("interateOrderedCollection(): " +
        // XString.prettyPrint(collectionObj));
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
            Object ocPage = firstPageUrl == null ? null : getJson(firstPageUrl, new MediaType("application", "activity+json"));

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
                    ocPage = nextPage == null ? null : getJson(nextPage, new MediaType("application", "activity+json"));
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
            Object ocPage = lastPageUrl == null ? null : getJson(lastPageUrl, new MediaType("application", "activity+json"));

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
}
