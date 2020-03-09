package org.subnode.service;

import java.net.URI;

import org.subnode.config.AppProp;
import org.subnode.model.MerkleNode;
import org.subnode.mongo.MongoApi;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.mongo.model.types.AllSubNodeTypes;
import org.subnode.util.XString;

import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import org.subnode.util.Util;

// https://docs.ipfs.io/reference/api/http/

/**
 * Right now exception handling in here is just temporary (not final) because
 * I'm just throwing together quick proof-of-concept IPFS browser capability.
 */
@Component
public class IPFSService {
    private static final Logger log = LoggerFactory.getLogger(IPFSService.class);

    /*
    originally this was 'data-endcoding' (or at least i got that from somewhere),
    but now their example page seems to show 'encoding' is the name here.
    */
    public static String ENCODING_PARAM_NAME = "encoding";

    /*
     * RestTempalte is thread-safe and reusable, and has no state, so we need only
     * one final static instance ever
     */
    private static final RestTemplate restTemplate = new RestTemplate(Util.getClientHttpRequestFactory());

    @Autowired
    private MongoApi api;

    @Autowired
    private AllSubNodeTypes TYPES;

    @Autowired
    private AppProp appProp;

    /**
     * Looks up quantizr node by 'nodeId', and gets the 'ipfs:link' property, which is used to
     * retrieve the MerkleNode (as JSON), and then pretty prints it and returns it
     */
    public final String getNodeInfo(MongoSession session, String nodeId) {
        String ret = "";
        SubNode node = api.getNode(session, nodeId);
        if (node != null) {
            String hash = node.getStringProp(TYPES.IPFS_LINK);
            if (StringUtils.isEmpty(hash)) {
                ret = "Node is missing IPFS link property: " + TYPES.IPFS_LINK.getType();
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
     * @return
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
}
