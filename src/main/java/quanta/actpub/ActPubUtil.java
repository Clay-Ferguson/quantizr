package quanta.actpub;

import static quanta.actpub.model.AP.apHasProps;
import static quanta.actpub.model.AP.apList;
import static quanta.actpub.model.AP.apObj;
import static quanta.actpub.model.AP.apStr;
import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;
import org.apache.commons.lang3.StringUtils;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import quanta.actpub.model.APList;
import quanta.actpub.model.APObj;
import quanta.actpub.model.APType;
import quanta.config.NodeName;
import quanta.config.ServiceBase;
import quanta.instrument.PerfMon;
import quanta.model.NodeInfo;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.model.client.PrincipalName;
import quanta.model.client.PrivilegeType;
import quanta.mongo.MongoDeleteEvent;
import quanta.mongo.MongoRepository;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.response.GetThreadViewResponse;
import quanta.util.ThreadLocals;
import quanta.util.Util;
import quanta.util.XString;

/**
 * AP-related utilities
 */
@Component
public class ActPubUtil extends ServiceBase {
    private static final Logger log = LoggerFactory.getLogger(ActPubUtil.class);

    @Autowired
    private ActPubLog apLog;

    private static final int MAX_THREAD_NODES = 6;

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
            actorUrl = apStr(self, APObj.href);
        }
        return actorUrl;
    }

    /*
     * Searches thru the 'links' array property on webFinger and returns the links array object that has
     * a 'rel' property that matches the value in the rel param string
     */
    public Object getLinkByRel(Object webFinger, String rel) {
        List<?> linksList = apList(webFinger, APObj.links, false);

        if (no(linksList))
            return null;

        for (Object link : linksList) {
            if (rel.equals(apStr(link, APObj.rel))) {
                return link;
            }
        }
        return null;
    }

    /*
     * Does the get with userDoingGet if exists, or else falls back to either the supplied ms, or the
     * admin ms.
     */
    public APObj getJson(MongoSession ms, String userDoingGet, String url, MediaType mediaType) {

        if (PrincipalName.ANON.s().equals(userDoingGet)) {
            userDoingGet = null;
        }
        String _userDoingGet = userDoingGet;

        if (ok(_userDoingGet)) {
            return (APObj) arun.run(as -> {
                String actor = apUtil.makeActorUrlForUserName(_userDoingGet);

                /* if private key not sent then get it using the session */
                String privateKey = apCrypto.getPrivateKey(as, _userDoingGet);
                if (no(privateKey)) {
                    throw new RuntimeException("Unable to get private key for user.");
                }
                return secureGet(url, privateKey, actor, mediaType);
            });
        } else if (ok(ms)) {
            String actor = apUtil.makeActorUrlForUserName(ms.getUserName());

            /* if private key not sent then get it using the session */
            String privateKey = apCrypto.getPrivateKey(ms, ms.getUserName());
            if (no(privateKey)) {
                throw new RuntimeException("Unable to get private key for user.");
            }
            return secureGet(url, privateKey, actor, mediaType);
        } else {
            return (APObj) arun.run(as -> {
                String actor = apUtil.makeActorUrlForUserName(as.getUserName());

                /* if private key not sent then get it using the session */
                String privateKey = apCrypto.getPrivateKey(as, as.getUserName());
                if (no(privateKey)) {
                    throw new RuntimeException("Unable to get private key for user.");
                }
                return secureGet(url, privateKey, actor, mediaType);
            });
        }
    }

    /**
     * Headers can be optionally passed in, preloaded with security properties, or else null is
     * acceptable too
     */
    @PerfMon(category = "apUtil")
    public APObj getJson(String url, MediaType mediaType, HttpHeaders headers) {
        // log.debug("getJson: " + url);
        APObj ret = null;
        int responseCode = 0;
        try {
            if (no(headers)) {
                headers = new HttpHeaders();
            }

            if (ok(mediaType)) {
                List<MediaType> acceptableMediaTypes = new LinkedList<>();
                acceptableMediaTypes.add(mediaType);
                headers.setAccept(acceptableMediaTypes);
            }

            MultiValueMap<String, Object> bodyMap = new LinkedMultiValueMap<>();
            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(bodyMap, headers);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, requestEntity, String.class);
            if (ok(response)) {
                responseCode = response.getStatusCodeValue();
                ret = mapper.readValue(response.getBody(), new TypeReference<>() {});
            }
            // log.debug("REQ: " + url + "\nRES: " + XString.prettyPrint(ret));
        } catch (HttpClientErrorException.Gone goneEx) {
            log.debug("http says Gone: " + url);
            return null;
        } catch (HttpClientErrorException.Forbidden forbiddenEx) {
            log.debug("http says Forbidden: " + url);
            return null;
        } catch (Exception e) {
            log.debug("failed getting json: " + url + " -> " + e.getMessage() + " ex.class=" + e.getClass().getName()
                    + " respCode=" + responseCode);
            return null;
        }
        return ret;
    }

    public APObj secureGet(String url, String privateKey, String actor, MediaType mediaType) {
        HttpHeaders headers = new HttpHeaders();
        apCrypto.loadSignatureHeaderVals(headers, privateKey, url, actor, null, "get");
        return getJson(url, mediaType, headers);
    }

    /* Posts to all inboxes */
    public void securePostEx(HashSet<String> inboxes, String fromActor, String privateKey, String actor, APObj message,
            MediaType postType) {
        if (no(inboxes))
            return;
        for (String inbox : inboxes) {
            try {
                apUtil.securePostEx(inbox, privateKey, fromActor, message, APConst.MTYPE_LD_JSON_PROF);
            }
            // catch error from any server, and ignore, go to next server to send to.
            catch (Exception e) {
                apLog.trace("failed to post to: " + inbox);
            }
        }
    }

    public void securePostEx(String url, String privateKey, String actor, APObj message, MediaType postType) {
        try {
            apLog.trace("Secure post to " + url);

            String body = XString.prettyPrint(message);
            apLog.trace("Posting Object:\n" + body);
            byte[] bodyBytes = body.getBytes(StandardCharsets.UTF_8);

            HttpHeaders headers = new HttpHeaders();
            apCrypto.loadSignatureHeaderVals(headers, privateKey, url, actor, bodyBytes, "post");
            postJson(url, body, headers, postType);
        } catch (Exception e) {
            log.error("ALL secure http post failed to: " + url, e);
            throw new RuntimeException(e);
        }
    }

    /*
     * Effeciently gets the Actor by using a cache to ensure we never get the same Actor twice until the
     * app restarts at least.
     * 
     * #todo-optimization: look for places we call this to get data we HAVE or should have locally, for
     * example to get: 1) followers 2) inbox (which we alread have a direct entry in apCache for inbox)
     * ...so we can definitely do a little optimization here around this
     */
    @PerfMon(category = "apUtil")
    public APObj getActorByUrl(MongoSession ms, String userDoingAction, String url) {
        if (no(url))
            return null;

        apub.saveFediverseName(url);

        // first try to return from cache.
        APObj actor = apCache.actorsByUrl.get(url);
        if (ok(actor)) {
            return actor;
        }

        try {
            actor = apUtil.getJson(ms, userDoingAction, url, APConst.MTYPE_ACT_JSON);
        } catch (Exception e) {
            log.error("Unable to get actor from url: " + url);
        }

        if (ok(actor)) {
            String userName = getLongUserNameFromActor(actor);
            apCache.actorsByUrl.put(url, actor);
            apCache.actorsByUserName.put(userName, actor);
        }
        // log.debug("Actor: " + XString.prettyPrint(actor));
        return actor;
    }

    public String getActorUrlFromForeignUserName(String userDoingAction, String userName) {
        String actorUrl = null;

        MongoSession as = auth.getAdminSession();
        SubNode userNode = apub.getAcctNodeByForeignUserName(as, userDoingAction, userName, false, true);
        if (ok(userNode)) {
            actorUrl = userNode.getStr(NodeProp.ACT_PUB_ACTOR_ID);
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
     * 
     * #todo-optimization: check for any calls to this where we could've gotten the needed data locally
     */
    public APObj getWebFinger(MongoSession ms, String userDoingAction, String resource) {
        apub.saveFediverseName(resource);

        return getWebFingerSec(ms, userDoingAction, resource, true);
        // need to re-enable this again if we plan on doing localhost fediverse testing (todo-2)
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
    public APObj getWebFingerSec(MongoSession ms, String userDoingAction, String userName, boolean secure) {
        if (userName.startsWith("@")) {
            userName = userName.substring(1);
        }
        String host = (secure ? "https://" : "http://") + getHostFromUserName(userName);

        if (apCache.webFingerFailsByUserName.contains(userName)) {
            return null;
        }

        // return from cache if we have this cached
        APObj finger = apCache.webFingerCacheByUserName.get(userName);
        if (ok(finger)) {
            return finger;
        }

        String url = host + APConst.PATH_WEBFINGER + "?resource=acct:" + userName;
        finger = getJson(ms, userDoingAction, url, APConst.MTYPE_JRD_JSON);

        if (ok(finger)) {
            // log.debug("Caching WebFinger: " + XString.prettyPrint(finger));
            apCache.webFingerCacheByUserName.put(userName, finger);
        } else {
            apCache.webFingerFailsByUserName.add(userName);
        }
        return finger;
    }

    public APObj postJson(String url, String body, HttpHeaders headers, MediaType postType) {
        APObj ret = null;
        try {
            // log.debug("postJson to: " + url);

            if (no(headers)) {
                headers = new HttpHeaders();
            }
            headers.setAccept(List.of(APConst.MTYPE_ACT_JSON, APConst.MTYPE_JSON));

            String appName = prop.getConfigText("brandingAppName");
            if (no(appName))
                appName = "Quanta";

            // NOTE: I'm not sure this is ever necessary. Noticed Pleroma doing it and copied it.
            headers.add("user-agent", appName + "; https://" + prop.getMetaHost() + " <fake@email.com>");

            headers.setContentType(postType);

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
    @PerfMon(category = "apUtil")
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
                                    .put(APObj.subject, "acct:" + username + "@" + fullHost) //
                                    .put(APObj.links, new APList() //
                                            .val(new APObj() //
                                                    .put(APObj.rel, "self") //
                                                    .put(APObj.type, APConst.CTYPE_ACT_JSON) //
                                                    .put(APObj.href, makeActorUrlForUserName(username))));

                            apLog.trace("Reply with WebFinger: " + XString.prettyPrint(webFinger));
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

    // #todo-optimization: we can call apub.getUserProperty() to get the value right? or is there a
    // direct cache entry for this?
    public String getLongUserNameFromActorUrl(MongoSession ms, String userDoingAction, String actorUrl) {
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

        APObj actor = getActorByUrl(ms, userDoingAction, actorUrl);
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
        String shortUserName = apStr(actor, APObj.preferredUsername); // short name like 'alice'
        String inbox = apStr(actor, APObj.inbox);
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

    public String fullFediNameOfThreadUser() {
        return ThreadLocals.getSC().getUserName() + "@" + prop.getMetaHost();
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

    public void iterateOrderedCollection(MongoSession ms, String userDoingAction, Object collectionObj, int maxCount,
            ActPubObserver observer) {
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
        List<?> orderedItems = apList(collectionObj, APObj.orderedItems, false);
        if (ok(orderedItems)) {
            /*
             * Commonly this will just be an array strings (like in a 'followers' collection on Mastodon)
             */
            for (Object obj : orderedItems) {
                if (!observer.item(obj)) {
                    return;
                }
                if (++count >= maxCount)
                    return;
            }
        }

        /*
         * Warning: There are times when even with only two items in the outbox Mastodon might send back an
         * empty array in the "first" page and the two items in the "last" page, which makes no sense, but
         * it just means we have to read and deduplicate all the items from all pages to be sure we don't
         * end up with a empty array even when there ARE some
         */
        Object firstPage = apObj(collectionObj, APObj.first);

        if (ok(firstPage)) {
            // log.debug("First Page Url: " + firstPageUrl);
            if (++pageQueries > maxPageQueries)
                return;

            Object ocPage = null;

            // if firstPage contained a String consider it a URL to the page and get it.
            if (firstPage instanceof String) {
                ocPage = getJson(ms, userDoingAction, (String) firstPage, APConst.MTYPE_ACT_JSON);
            }
            // else consider firstPage to be the ACTUAL first page object
            else {
                ocPage = firstPage;
            }

            while (ok(ocPage)) {
                orderedItems = apList(ocPage, APObj.orderedItems, false);

                if (ok(orderedItems)) {
                    for (Object item : orderedItems) {
                        // if item is an object (map)
                        if (apHasProps(item)) {
                            String apId = apStr(item, APObj.id);
                            // if no apId that's fine, just process item.
                            if (no(apId)) {
                                if (!observer.item(item))
                                    return;
                            }
                            // if no apId that's fine, just process item.
                            else if (!apIdSet.contains(apId)) {
                                // log.debug("Iterate Collection Item: " + apId);
                                if (!observer.item(item))
                                    return;
                                apIdSet.add(apId);
                            }
                        }
                        // otherwise item is probably a 'String' but whatever it is we call 'item' on
                        // it.
                        else {
                            if (!observer.item(item))
                                return;
                        }
                        if (++count >= maxCount)
                            return;
                    }
                }

                Object nextPage = apObj(ocPage, APObj.next);

                if (ok(nextPage)) {
                    if (++pageQueries > maxPageQueries)
                        return;

                    // if nextPage is a string consider that a reference to the URL of the page and get it
                    if (nextPage instanceof String) {
                        ocPage = getJson(ms, userDoingAction, (String) nextPage, APConst.MTYPE_ACT_JSON);
                    } else {
                        ocPage = nextPage;
                    }
                } else {
                    break;
                }
            }
        }

        Object lastPage = apObj(collectionObj, APObj.last);
        if (ok(lastPage)) {
            // log.debug("Last Page Url: " + lastPageUrl);
            if (++pageQueries > maxPageQueries)
                return;

            Object ocPage = null;

            // if lastPage is a string it's the url
            if (lastPage instanceof String) {
                ocPage = getJson(ms, userDoingAction, (String) lastPage, APConst.MTYPE_ACT_JSON);
            }
            // else it's the page object
            else {
                ocPage = lastPage;
            }
            if (ok(ocPage)) {
                orderedItems = apList(ocPage, APObj.orderedItems, false);

                if (ok(orderedItems)) {
                    for (Object item : orderedItems) {
                        // if item is an object (map)
                        if (apHasProps(item)) {
                            String apId = apStr(item, APObj.id);
                            // if no apId that's fine, just process item.
                            if (no(apId)) {
                                if (!observer.item(item))
                                    return;
                            }
                            // else process it with apId
                            else if (!apIdSet.contains(apId)) {
                                // log.debug("Iterate Collection Item: " + apId);
                                if (!observer.item(item))
                                    return;
                                apIdSet.add(apId);
                            }
                        }
                        // otherwise item is probably a 'String' but whatever it is we call 'item' on
                        // it.
                        else {
                            if (!observer.item(item))
                                return;
                        }
                        if (++count >= maxCount)
                            return;
                    }
                }
            }
        }
    }

    /* Try to generate the best 'inReplyTo' that TARGETS this node */
    public String buildUrlForReplyTo(MongoSession ms, SubNode node) {
        if (no(node))
            return null;

        // try this property first.
        String replyTo = node.getStr(NodeProp.ACT_PUB_OBJ_URL);

        // fall back to this...
        if (no(replyTo)) {
            replyTo = node.getStr(NodeProp.ACT_PUB_ID);
        }

        // or finally reference pointing to our own server node, if it's not private
        if (no(replyTo)) {
            replyTo = snUtil.getIdBasedUrl(node);
        }

        return replyTo;
    }

    /*
     * Every node getting deleted will call into here (via a hook in MongoEventListener), so we can do
     * whatever we need to in this hook, which for now is just used to manage unfollowing a Friend if a
     * friend is deleted
     */
    public void deleteNodeNotify(ObjectId nodeId) {
        if (!MongoRepository.fullInit)
            return;

        arun.run(ms -> {
            SubNode node = read.getNode(ms, nodeId);
            if (ok(node) && node.isType(NodeType.FRIEND)) {
                String friendUserName = node.getStr(NodeProp.USER);
                if (ok(friendUserName)) {
                    // if a foreign user, update thru ActivityPub
                    if (friendUserName.contains("@") && ok(ThreadLocals.getSC()) && !ThreadLocals.getSC().isAdmin()) {
                        String followerUser = ThreadLocals.getSC().getUserName();
                        apFollowing.setFollowing(followerUser, friendUserName, false);
                    }
                }
            }
            return null;
        });
    }

    @EventListener
    public void onApplicationEvent(MongoDeleteEvent event) {
        deleteNodeNotify((ObjectId) event.getSource());
    }

    /*
     * Gets the "[Conversation] Thread" for 'nodeId' which is kind of the equivalent of the walk up
     * towards the root of the tree, also importing as we go along any 'inReplyTo' references we haven't
     * already loaded
     */
    public GetThreadViewResponse getNodeThreadView(MongoSession ms, String nodeId, boolean loadOthers) {
        log.debug("getNodeThreadView");
        GetThreadViewResponse res = new GetThreadViewResponse();
        LinkedList<NodeInfo> nodes = new LinkedList<>();
        LinkedList<NodeInfo> others = loadOthers ? new LinkedList<>() : null;

        // get node that's going to have it's ancestors gathered
        SubNode node = read.getNode(ms, nodeId);
        boolean topReached = false;

        if (ok(node)) {

            // iterate up the parent chain or chain of inReplyTo for ActivityPub
            while (!topReached && ok(node) && nodes.size() < MAX_THREAD_NODES) {
                try {
                    nodes.addFirst(convert.convertToNodeInfo(ThreadLocals.getSC(), ms, node, true, false, -1, false, false, false,
                            false, true, true));

                    // if inReplyTo exists try to use it first.
                    String inReplyTo = node.getStr(NodeProp.ACT_PUB_OBJ_INREPLYTO);
                    if (ok(inReplyTo)) {
                        SubNode parentNode = apUtil.loadObject(ms, ThreadLocals.getSC().getUserName(), inReplyTo);
                        if (ok(parentNode)) {
                            node = parentNode;

                            /*
                             * if this is the first parent we're accessing (nodes.size will be 1), and it's a post node, we
                             * consider this a case where there's no conversation to show and bail out here.
                             */
                            if (nodes.size() == 1 && (node.isType(NodeType.POSTS) || node.isType(NodeType.ACT_PUB_POSTS))) {
                                res.setSuccess(true);
                                return res;
                            }

                            continue;
                        }
                    }

                    // if no database parent, check and see if we can get the node via inReplyTo
                    if (no(node.getParent())) {
                        topReached = true;
                    } else {
                        node = read.getParent(ms, node);

                        /*
                         * if this is the first parent we're accessing (nodes.size will be 1), and it's a post node, we
                         * consider this a case where there's no conversation to show and bail out here.
                         */
                        if (ok(node) && nodes.size() == 1
                                && (node.isType(NodeType.POSTS) || node.isType(NodeType.ACT_PUB_POSTS))) {
                            res.setSuccess(true);
                            return res;
                        }
                    }

                    /*
                     * if we just got the first parent encountered going up, then show all other replies this user or
                     * anyone else had made. These are all the siblings of NodeId. (i.e. sibling means having same
                     * parentt
                     */
                    if (loadOthers && nodes.size() == 1 && !node.isType(NodeType.POSTS)
                            && !node.isType(NodeType.ACT_PUB_POSTS)) {
                        // gets the 10 most recent posts (no need to get them all or even tell user we're not getting them
                        // all)
                        Iterable<SubNode> iter =
                                read.getChildren(ms, node, Sort.by(Sort.Direction.DESC, SubNode.CREATE_TIME), 10, 0);
                        for (SubNode child : iter) {
                            // add only if not nodeId becasue nodeId is all the others BUT nodeId, by definition.
                            if (!child.getIdStr().equals(nodeId)) {
                                others.add(convert.convertToNodeInfo(ThreadLocals.getSC(), ms, child, true, false, -1, false,
                                        false, false, false, true, true));
                            }
                        }
                    }
                } catch (Exception e) {
                    node = null;
                    topReached = true;
                    /*
                     * ignore this. Every user will eventually end up at some non-root node they don't own, even if it's
                     * the one above their account, this represents how far up the user is able to read towards the root
                     * of the tree based on sharing setting of nodes encountered along the way to the root.
                     */
                }
            }
        }

        res.setTopReached(topReached);
        res.setNodes(nodes);
        res.setOthers(others);
        res.setSuccess(true);
        return res;
    }

    /*
     * Loads the foreign object into Quanta under the foreign account representing that user, and
     * returns it. Returns existing node if found instead. If there's no account created yet for the
     * user we create the account
     */
    public SubNode loadObject(MongoSession ms, String userDoingAction, String url) {
        // log.debug("loadObject: url=" + url + " userDoingAction: " + userDoingAction);
        if (no(url))
            return null;

        // Try to look up the node first from the DB.
        SubNode nodeFound = read.findNodeByProp(ms, NodeProp.ACT_PUB_ID.s(), url);
        if (ok(nodeFound)) {
            return nodeFound;
        }

        // node not found in DB yet, so we have to get it from off the web from scratch
        APObj obj = apUtil.getJson(ms, userDoingAction, url, APConst.MTYPE_ACT_JSON);
        if (no(obj)) {
            log.debug("unable to get json: " + url);
            return null;
        }

        String type = apStr(obj, APObj.type);

        switch (type) {
            case APType.Note:
                String ownerActorUrl = apStr(obj, APObj.attributedTo);
                if (ok(ownerActorUrl)) {
                    return (SubNode) arun.run(as -> {
                        SubNode node = null;
                        SubNode accountNode = apub.getAcctNodeByActorUrl(as, userDoingAction, ownerActorUrl);
                        if (ok(accountNode)) {
                            String apUserName = accountNode.getStr(NodeProp.USER);
                            SubNode outboxNode =
                                    read.getUserNodeByType(as, apUserName, accountNode, "### Posts", NodeType.ACT_PUB_POSTS.s(),
                                            Arrays.asList(PrivilegeType.READ.s(), PrivilegeType.WRITE.s()), NodeName.POSTS);
                            if (no(outboxNode)) {
                                log.debug("no outbox for user: " + apUserName);
                                return null;
                            }

                            node = apub.saveObj(as, userDoingAction, accountNode, outboxNode, obj, false, APType.Create, null,
                                    null);
                        }
                        return node;
                    });
                }
                break;
            default:
                log.debug("Unhandled type in loadObject: " + type);
                break;
        }
        return null;
    }

    /*
     * Updates all the ActPub properties from actor object onto the node, and returns true only of
     * something was indeed changed so that the DB will only get updated if something DID change
     */
    public boolean updateNodeFromActorObject(SubNode node, Object actor) {
        boolean changed = false;
        Object icon = apObj(actor, APObj.icon);
        if (ok(icon)) {
            String iconUrl = apStr(icon, APObj.url);
            if (ok(iconUrl)) {
                String curIconUrl = node.getStr(NodeProp.ACT_PUB_USER_ICON_URL);
                if (!iconUrl.equals(curIconUrl)) {
                    if (node.set(NodeProp.ACT_PUB_USER_ICON_URL, iconUrl)) {
                        changed = true;
                    }
                }
            }
        }

        Object endpoints = apObj(actor, APObj.endpoints);
        if (ok(endpoints)) {
            String sharedInbox = apStr(endpoints, APObj.sharedInbox);
            if (ok(sharedInbox)) {
                String curSharedInbox = node.getStr(NodeProp.ACT_PUB_SHARED_INBOX);
                if (!sharedInbox.equals(curSharedInbox)) {
                    if (node.set(NodeProp.ACT_PUB_SHARED_INBOX, sharedInbox)) {
                        changed = true;
                    }
                }
            }
        }

        Object image = apObj(actor, APObj.image);
        if (ok(image)) {
            String imageUrl = apStr(image, APObj.url);
            if (ok(imageUrl)) {
                String curImageUrl = node.getStr(NodeProp.ACT_PUB_USER_IMAGE_URL);
                if (!imageUrl.equals(curImageUrl)) {
                    if (node.set(NodeProp.ACT_PUB_USER_IMAGE_URL, imageUrl)) {
                        changed = true;
                    }
                }
            }
        }

        if (node.set(NodeProp.USER_BIO, apStr(actor, APObj.summary)))
            changed = true;

        if (node.set(NodeProp.DISPLAY_NAME, apStr(actor, APObj.name)))
            changed = true;

        String actorId = apStr(actor, APObj.id);
        if (no(actorId)) {
            log.debug("no actorId on object: " + XString.prettyPrint(actor));
        }

        // this is the URL of the Actor JSON object
        if (node.set(NodeProp.ACT_PUB_ACTOR_ID, actorId))
            changed = true;

        String inbox = apStr(actor, APObj.inbox);

        // update cache just because we can
        apCache.inboxesByUserName.put(node.getStr(NodeProp.USER), inbox);

        if (node.set(NodeProp.ACT_PUB_ACTOR_INBOX, inbox))
            changed = true;

        // this is the URL of the HTML of the actor.
        if (node.set(NodeProp.ACT_PUB_ACTOR_URL, apStr(actor, APObj.url)))
            changed = true;

        // get the pubKey so we can save into our account node
        String pubKey = apCrypto.getEncodedPubKeyFromActorObj(actor);

        // this is the PublicKey.pubKeyPem, of the user
        if (node.set(NodeProp.ACT_PUB_KEYPEM, pubKey))
            changed = true;

        return changed;
    }
}
