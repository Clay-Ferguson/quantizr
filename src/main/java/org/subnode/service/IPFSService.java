package org.subnode.service;

import java.io.InputStream;
import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.apache.commons.lang3.StringUtils;
import org.apache.http.HttpResponse;
import org.apache.http.client.HttpClient;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.impl.client.HttpClientBuilder;
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
import org.subnode.config.AppProp;
import org.subnode.exception.base.RuntimeEx;
import org.subnode.model.MerkleNode;
import org.subnode.model.client.NodeProp;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.util.Const;
import org.subnode.util.LimitedInputStreamEx;
import org.subnode.util.Util;
import org.subnode.util.ValContainer;
import org.subnode.util.XString;

@Component
public class IPFSService {
    private static final Logger log = LoggerFactory.getLogger(IPFSService.class);

    private static String INTERNAL_IPFS_GATEWAY = "http://ipfs:8080/ipfs/";

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
    private MongoRead read;

    @Autowired
    private AppProp appProp;

    /**
     * Looks up quanta node by 'nodeId', and gets the 'ipfs:link' property, which is
     * used to retrieve the MerkleNode (as JSON), and then pretty prints it and
     * returns it.
     */
    public final String getNodeInfo(MongoSession session, String nodeId) {
        String ret = "";
        SubNode node = read.getNode(session, nodeId);
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
            // log.error("Failed in restTemplate.getForEntity", e);
        }
        return ret;
    }

    public final boolean removePin(String cid) {
        try {
            String url = appProp.getIPFSHost() + "/api/v0/pin/rm?arg=" + cid;
            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(null, null);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, requestEntity, String.class);
            return response.getStatusCode().value() == 200;
        } catch (Exception e) {
            log.error("Failed in restTemplate.exchange", e);
        }
        return false;
    }

    public final LinkedHashMap<String, Object> getPins() {
        LinkedHashMap<String, Object> pins = null;
        try {
            String url = appProp.getIPFSHost() + "/api/v0/pin/ls?type=recursive";

            ResponseEntity<String> result = restTemplate.getForEntity(new URI(url), String.class);
            MediaType contentType = result.getHeaders().getContentType();

            // log.debug("RAW RESULT: " + result.getBody());

            if (MediaType.APPLICATION_JSON.equals(contentType)) {
                Map<String, Object> respMap = mapper.readValue(result.getBody(),
                        new TypeReference<Map<String, Object>>() {
                        });
                pins = (LinkedHashMap<String, Object>) respMap.get("Keys");
            }
        } catch (Exception e) {
            // log.error("Failed in restTemplate.getForEntity", e);
        }
        return pins;
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

            // log.debug("RAW RESULT: " + result.getBody());

            if (MediaType.APPLICATION_JSON.equals(contentType)) {
                ret = XString.jsonMapper.readValue(result.getBody(), MerkleNode.class);
                ret.setHash(hash);
                ret.setContentType(contentType.getType());
                // String formatted = XString.prettyPrint(ret);
                // log.debug(formatted);
            }

        } catch (Exception e) {
            log.error("Failed in restTemplate.getForEntity", e);
        }
        return ret;
    }

    /**
     * Returns string of the the hash get, as requested usingn the 'encoding=' url
     * argument specified.
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
            log.error("Failed in restTemplate.getForEntity", e);
        }
        return ret;
    }

    public String addFromStream(MongoSession session, InputStream stream, String mimeType,
            ValContainer<Integer> streamSize) {
        String hash = null;
        try {
            // https://docs-beta.ipfs.io/reference/http/api
            // --stream-channels bool - Stream channel output.
            String url = appProp.getIPFSHost() + "/api/v0/add?stream-channels=true";
            HttpHeaders headers = new HttpHeaders();

            MultiValueMap<String, Object> bodyMap = new LinkedMultiValueMap<>();
            LimitedInputStreamEx lis = new LimitedInputStreamEx(stream, session.getMaxUploadSize());
            bodyMap.add("file", new InputStreamResource(lis));

            headers.setContentType(MediaType.MULTIPART_FORM_DATA);
            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(bodyMap, headers);

            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, requestEntity, String.class);

            // todo-1: create dedicated return object for this (json marshalled)
            Map<String, Object> respMap = mapper.readValue(response.getBody(),
                    new TypeReference<Map<String, Object>>() {
                    });

            // log.debug("respMap=" + XString.prettyPrint(respMap));

            hash = (String) respMap.get("Hash");
            streamSize.setVal((int) lis.getCount());
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
        String sourceUrl = INTERNAL_IPFS_GATEWAY + hash;

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
            // log.debug("Response Code: " + response.getStatusLine().getStatusCode() + "
            // reason="
            // + response.getStatusLine().getReasonPhrase());
            InputStream is = response.getEntity().getContent();
            return is;
        } catch (Exception e) {
            throw new RuntimeEx("Streaming failed.", e);
        }
    }
}
