package org.subnode.service;

import java.io.InputStream;
import java.net.URI;

import org.subnode.config.AppProp;
import org.subnode.model.MerkleNode;
import org.subnode.model.client.NodeProp;
import org.subnode.mongo.MongoApi;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.util.XString;

import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.subnode.util.Const;
import org.subnode.util.Util;

import java.util.HashMap;
import java.util.Map;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.apache.http.HttpResponse;
import org.apache.http.client.HttpClient;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.impl.client.HttpClientBuilder;

/**
 * Right now exception handling in here is just temporary (not final) because
 * I'm just throwing together quick proof-of-concept IPFS browser capability.
 */
@Component
public class IPFSService {
    private static final Logger log = LoggerFactory.getLogger(IPFSService.class);

    private static final String TEMPORAL_HOST = "https://api.temporal.cloud";

    /*
     * originally this was 'data-endcoding' (or at least i got that from somewhere),
     * but now their example page seems to show 'encoding' is the name here.
     */
    public static String ENCODING_PARAM_NAME = "encoding";

    /*
     * RestTempalte is thread-safe and reusable, and has no state, so we need only
     * one final static instance ever
     */
    private static final RestTemplate restTemplate = new RestTemplate(Util.getClientHttpRequestFactory());

    private static final ObjectMapper mapper = new ObjectMapper();

    @Autowired
    private MongoApi api;

    @Autowired
    private AppProp appProp;

    @Autowired
    private AttachmentService attachmentService;

    /**
     * Looks up quantizr node by 'nodeId', and gets the 'ipfs:link' property, which
     * is used to retrieve the MerkleNode (as JSON), and then pretty prints it and
     * returns it.
     */
    public final String getNodeInfo(MongoSession session, String nodeId) {
        String ret = "";
        SubNode node = api.getNode(session, nodeId);
        if (node != null) {
            String hash = node.getStringProp(NodeProp.IPFS_LINK);
            if (StringUtils.isEmpty(hash)) {
                ret = "Node is missing IPFS link property: " + NodeProp.IPFS_LINK.s();
            } else {
                MerkleNode mnode = getMerkleNode(hash, "json");
                if (mnode != null) {
                    ret = XString.prettyPrint(mnode);
                } else {
                    ret = "Unable to get as MerkleNode.";
                }
            }
        } else {
            ret = "Unable to get SubNode for id=" + nodeId;
        }
        return ret;
    }

    /**
     * Reads the bytes from 'ipfs hash', expecting them to be UTF-8 and returns the
     * string.
     * 
     * NOTE: The hash is allowed to have a subpath here.
     */
    public final String objectCat(String hash) {
        String ret = null;
        try {
            String url = appProp.getIPFSHost() + "/api/v0/cat?arg=" + hash;

            ResponseEntity<byte[]> result = restTemplate.getForEntity(new URI(url), byte[].class);
            // MediaType contentType = result.getHeaders().getContentType();
            // log.debug("cat bytes contentType=" + contentType);

            ret = new String(result.getBody(), "UTF-8");
        } catch (Exception e) {
            // log.error("Failed in restTemplate.exchange", e);
        }
        return ret;
    }

    /**
     * @param hash
     * @param encoding text | json
     * @return MerkleNode of the hash, as requested usingn the 'encoding=' url
     *         argument specified.
     */
    public final MerkleNode getMerkleNode(String hash, String encoding) {
        MerkleNode ret = null;
        try {
            String url = appProp.getIPFSHost() + "/api/v0/object/get?arg=" + hash + "&" + ENCODING_PARAM_NAME + "="
                    + encoding;

            log.debug("REQ: " + url);

            ResponseEntity<String> result = restTemplate.getForEntity(new URI(url), String.class);
            MediaType contentType = result.getHeaders().getContentType();

            log.debug("RAW RESULT: " + result.getBody());

            if (MediaType.APPLICATION_JSON.equals(contentType)) {
                ret = XString.jsonMapper.readValue(result.getBody(), MerkleNode.class);
                ret.setHash(hash);
                ret.setContentType(contentType.getType());
                // String formatted = XString.prettyPrint(ret);
                // log.debug(formatted);
            }

        } catch (Exception e) {
            log.error("Failed in restTemplate.exchange", e);
        }
        return ret;
    }

    /**
     * @param hash
     * @param encoding text | json
     * @return Returns string of the the hash get, as requested usingn the
     *         'encoding=' url argument specified.
     */
    public final String getAsString(String hash, String encoding) {
        String ret = null;
        try {
            String url = appProp.getIPFSHost() + "/api/v0/object/get?arg=" + hash + "&" + ENCODING_PARAM_NAME + "="
                    + encoding;

            ResponseEntity<String> result = restTemplate.getForEntity(new URI(url), String.class);
            MediaType contentType = result.getHeaders().getContentType();

            if (MediaType.APPLICATION_JSON.equals(contentType)) {
                ret = result.getBody();
            } else {
                log.debug("RAW BODY: " + result.getBody());
            }
        } catch (Exception e) {
            log.error("Failed in restTemplate.exchange", e);
        }
        return ret;
    }

    public String addFromStream(InputStream stream, String mimeType, boolean saveToTemporal) {
        if (saveToTemporal) {
            return addToTemporalFromStream(stream, mimeType);
        } else {
            return addFromStream(stream, mimeType);
        }
    }

    /**
     * Logs into temporal and gets token. This code is tested and DOES work ok,
     * however the design changed and for now all Temporal uploading is done purely
     * on the client so this method is currently not ever called.
     * 
     * https://gateway.temporal.cloud/ipns/docs.api.temporal.cloud/account.html#account-management
     */
    private String temporalLogin() {
        String token = null;
        try {
            String url = TEMPORAL_HOST + "/v2/auth/login";
            HttpHeaders headers = new HttpHeaders();

            // MultiValueMap<String, Object> bodyMap = new LinkedMultiValueMap<>();
            // bodyMap.add("file", new InputStreamResource(stream));

            HashMap<String, String> bodyMap = new HashMap<>();

            bodyMap.put("username", "WClayFerguson");
            bodyMap.put("password", "<fake password> Tested with real password and this code does work.");
            String bodyStr = XString.prettyPrint(bodyMap);

            headers.setContentType(MediaType.TEXT_PLAIN);
            HttpEntity<String> requestEntity = new HttpEntity<>(bodyStr, headers);

            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, requestEntity, String.class);

            // todo-1: create dedicated return object for this (json marshalled)
            Map<String, Object> respMap = mapper.readValue(response.getBody(),
                    new TypeReference<Map<String, Object>>() {
                    });

            token = (String) respMap.get("token");
            // the following other values are supposedly in the return...
            // {
            // "Bytes": "<int64>",
            // "Hash": "<string>",
            // "Name": "<string>",
            // "Size": "<string>"
            // }

        } catch (Exception e) {
            log.error("Failed in restTemplate.exchange", e);
            throw new RuntimeException("failed to get temporal login token.");
        }
        return token;
    }

    /**
     * WARNING: Although I know this code is likely 100% correct it still doesn't
     * work on "Temporal.cloud" and I'm tentatively blaming them for the failure,
     * because my IPFS code to upload to local IPFS works fine (just below)
     * 
     * However I decided it's ok for now to let users signup on "Temporal.cloud" and
     * get their storage paid for thru that site and I can then make it where we
     * never even get their Temporal credentials nor upload thru Quantizr server
     * either, which means for now this Java Server Side upload capability to
     * Temporal is no longer needed.
     * 
     * Will circle back and troubleshoot this code more if ever needed.
     */
    private String addToTemporalFromStream(InputStream stream, String mimeType) {
        String token = temporalLogin();

        String hash = null;
        try {
            /*
             * https://docs-beta.ipfs.io/reference/http/api --stream-channels bool - Stream
             * channel output.
             */
            String url = TEMPORAL_HOST + "/v2/ipfs/public/file/add"; // ?stream-channels=true";
            HttpHeaders headers = new HttpHeaders();

            MultiValueMap<String, Object> bodyMap = new LinkedMultiValueMap<>();
            bodyMap.add("file", new InputStreamResource(stream));
            bodyMap.add("hold_time", Integer.valueOf(1));

            headers.setContentType(MediaType.MULTIPART_FORM_DATA);
            headers.set("Authorization", "Bearer " + token);
            headers.set("cache-control", "no-cache"); // not needed?
            // headers.set("Accept", "*/*"); //not needed?
            // headers.set("Host", "api.temporal.cloud"); //not needed?
            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(bodyMap, headers);

            // This results in: Bad Request: [{"code":400,"response":"http: no such file"}
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, requestEntity, String.class);

            // todo-1: create dedicated return object for this (json marshalled)
            Map<String, Object> respMap = mapper.readValue(response.getBody(),
                    new TypeReference<Map<String, Object>>() {
                    });

            hash = (String) respMap.get("response");

        } catch (Exception e) {
            log.error("Failed in restTemplate.exchange", e);
            throw new RuntimeException("failed to save to IPFS using temporal.");
        }
        return hash;
    }

    private String addFromStream(InputStream stream, String mimeType) {
        String hash = null;
        try {
            // https://docs-beta.ipfs.io/reference/http/api
            // --stream-channels bool - Stream channel output.
            String url = appProp.getIPFSHost() + "/api/v0/add?stream-channels=true";
            HttpHeaders headers = new HttpHeaders();

            MultiValueMap<String, Object> bodyMap = new LinkedMultiValueMap<>();
            bodyMap.add("file", new InputStreamResource(stream));

            headers.setContentType(MediaType.MULTIPART_FORM_DATA);
            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(bodyMap, headers);

            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, requestEntity, String.class);

            // todo-1: create dedicated return object for this (json marshalled)
            Map<String, Object> respMap = mapper.readValue(response.getBody(),
                    new TypeReference<Map<String, Object>>() {
                    });

            hash = (String) respMap.get("Hash");
            // the following other values are supposedly in the return...
            // {
            // "Bytes": "<int64>",
            // "Hash": "<string>",
            // "Name": "<string>",
            // "Size": "<string>"
            // }

        } catch (Exception e) {
            log.error("Failed in restTemplate.exchange", e);
        }
        return hash;
    }

    public InputStream getStream(MongoSession session, String hash, String mimeType) {
        String sourceUrl = "http://ipfs:8080/ipfs/" + hash;

        try {
            int timeout = 20;
            RequestConfig config = RequestConfig.custom()//
                    .setConnectTimeout(timeout * 1000) //
                    .setConnectionRequestTimeout(timeout * 1000) //
                    .setSocketTimeout(timeout * 1000).build();

            HttpClient client = HttpClientBuilder.create().setDefaultRequestConfig(config).build();
            HttpGet request = new HttpGet(sourceUrl);

            request.addHeader("User-Agent", Const.FAKE_USER_AGENT);
            HttpResponse response = client.execute(request);
            //log.debug("Response Code: " + response.getStatusLine().getStatusCode() + " reason="
            //        + response.getStatusLine().getReasonPhrase());
            InputStream is = response.getEntity().getContent();
            return is;
        } catch (Exception e) {
            throw new RuntimeException("Streaming failed.", e);
        }
    }
}
