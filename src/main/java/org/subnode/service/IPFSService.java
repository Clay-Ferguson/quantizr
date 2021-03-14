package org.subnode.service;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.FileInputStream;
import java.io.InputStream;
import java.net.URI;
import java.net.URL;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;

import javax.annotation.PostConstruct;
import javax.servlet.http.HttpServletResponse;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.apache.commons.io.IOUtils;
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
import org.springframework.http.ContentDisposition;
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
import org.subnode.config.SpringContextUtil;
import org.subnode.exception.base.RuntimeEx;
import org.subnode.model.IPFSDir;
import org.subnode.model.IPFSDirEntry;
import org.subnode.model.IPFSDirStat;
import org.subnode.model.IPFSObjectStat;
import org.subnode.model.MerkleLink;
import org.subnode.model.MerkleNode;
import org.subnode.model.client.NodeProp;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.RunAsMongoAdmin;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.LoadNodeFromIpfsRequest;
import org.subnode.request.PublishNodeToIpfsRequest;
import org.subnode.response.LoadNodeFromIpfsResponse;
import org.subnode.response.PublishNodeToIpfsResponse;
import org.subnode.util.Cast;
import org.subnode.util.Const;
import org.subnode.util.ExUtil;
import org.subnode.util.LimitedInputStreamEx;
import org.subnode.util.StreamUtil;
import org.subnode.util.ThreadLocals;
import org.subnode.util.Util;
import org.subnode.util.ValContainer;
import org.subnode.util.XString;

// IPFS Reference: https://docs.ipfs.io/reference/http/api

/* todo-0: There are several places in here where we're getting back a "String" from a restTemplate.exchange for getting back JSON, and we can
probably define a POJO and let the converter convert do this for us always instead */

@Component
public class IPFSService {
    private static final Logger log = LoggerFactory.getLogger(IPFSService.class);

    private static String API_BASE;
    private static String API_CAT;
    private static String API_FILES;
    private static String API_PIN;
    private static String API_OBJECT;
    private static String API_DAG;
    private static String API_TAR;
    private static String API_NAME;
    private static String API_REPO;

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
    private RunAsMongoAdmin adminRunner;

    @Autowired
    private MongoRead read;

    @Autowired
    private AppProp appProp;

    @Autowired
    AttachmentService attachmentService;

    @PostConstruct
    public void init() {
        API_BASE = appProp.getIPFSApiHostAndPort() + "/api/v0";
        API_CAT = API_BASE + "/cat";
        API_FILES = API_BASE + "/files";
        API_PIN = API_BASE + "/pin";
        API_OBJECT = API_BASE + "/object";
        API_DAG = API_BASE + "/dag";
        API_TAR = API_BASE + "/tar";
        API_NAME = API_BASE + "/name";
        API_REPO = API_BASE + "/repo";
    }

    public String getRepoStat() {
        String url = API_REPO + "/stat?human=true";
        LinkedHashMap<String, Object> res = Cast.toLinkedHashMap(postForJsonReply(url, LinkedHashMap.class));
        return "\nIPFS Repository Status:\n" + XString.prettyPrint(res) + "\n";
    }

    /*
     * this appears to be broken due to a bug in IPFS? Haven't reported an error to
     * them yet. Returns HTTP success (200), but no data. It should be returnin JSON but doesn't, so I have 
     * hacked the postForJsonReply to always return 'success' in this scenario (200 with no body)
     */
    public String repoVerify() {
        String url = API_REPO + "/verify";
        LinkedHashMap<String, Object> res = Cast.toLinkedHashMap(postForJsonReply(url, LinkedHashMap.class));
        return "\nIPFS Repository Verify:\n" + XString.prettyPrint(res) + "\n";
    }

    public String pinVerify() {
        String url = API_PIN + "/verify";
        // LinkedHashMap<String, Object> res =
        // Cast.toLinkedHashMap(postForJsonReply(url, LinkedHashMap.class));
        // casting to a string now, because a bug in IPFS is making it not return data, so we get back string "success"
        String res = (String) postForJsonReply(url, String.class);
        return "\nIPFS Pin Verify:\n" + XString.prettyPrint(res) + "\n";
    }

    public String getRepoGC() {
        String url = API_REPO + "/gc";
        LinkedHashMap<String, Object> res = Cast.toLinkedHashMap(postForJsonReply(url, LinkedHashMap.class));
        return "\nIPFS Repository Garbage Collect:\n" + XString.prettyPrint(res) + "\n";
    }

    /* Ensures this node's attachment is saved to IPFS and returns the CID of it */
    public final String saveNodeAttachmentToIpfs(MongoSession session, SubNode node) {
        String cid = null;
        String mime = node.getStrProp(NodeProp.BIN_MIME);
        String fileName = node.getStrProp(NodeProp.FILENAME);

        InputStream is = attachmentService.getStreamByNode(node, "");
        if (is != null) {
            try {
                MerkleLink ret = addFromStream(session, is, fileName, mime, null, null, false);
                if (ret != null) {
                    cid = ret.getHash();
                }
            } catch (Exception e) {
                e.printStackTrace();
            } finally {
                StreamUtil.close(is);
            }
        } else {
            log.debug("Unable to get inputstream or oid.");
        }

        return cid;
    }

    /**
     * Reads the bytes from 'ipfs hash', expecting them to be UTF-8 and returns the
     * string.
     * 
     * NOTE: The hash is allowed to have a subpath here.
     */
    public final String catToString(String hash) {
        String ret = null;
        try {
            String url = API_CAT + "?arg=" + hash;
            ResponseEntity<byte[]> result = restTemplate.getForEntity(new URI(url), byte[].class);
            ret = new String(result.getBody(), "UTF-8");
        } catch (Exception e) {
            // log.error("Failed in restTemplate.getForEntity", e);
        }
        return ret;
    }

    public InputStream getInputStream(String hash) {
        String url = API_CAT + "?arg=" + hash;
        InputStream is = null;
        try {
            is = new URL(url).openStream();
        } catch (Exception e) {
            log.error("Failed in read: " + url, e);
        }
        return is;
    }

    public final IPFSDir getDir(String path) {
        String url = API_FILES + "/ls?arg=" + path + "&long=true";
        return (IPFSDir) postForJsonReply(url, IPFSDir.class);
    }

    /*
     * todo-0: Adding and removing PINs should count against this user's storage
     * quota! Also check the ordinary flow path of using upload dialog with the IPFS
     * checkbox checked way of uploading data directly from an actual stream of a
     * file, and be sure that is also counting against the user's quota.
     */
    public final boolean removePin(String cid) {
        // log.debug("Remove Pin: " + cid);
        String url = API_PIN + "/rm?arg=" + cid;
        return postForJsonReply(url, Object.class) != null;
    }

    public final boolean addPin(String cid) {
        // log.debug("Add Pin: " + cid);
        String url = API_PIN + "/add?arg=" + cid;
        return postForJsonReply(url, Object.class) != null;
    }

    /* Deletes the file or if a folder deletes it recursively */
    public final boolean deletePath(String path) {
        String url = API_FILES + "/rm?arg=" + path + "&force=true";
        return postForJsonReply(url, Object.class) != null;
    }

    public final boolean flushFiles(String path) {
        String url = API_FILES + "/flush?arg=" + path;
        return postForJsonReply(url, Object.class) != null;
    }

    public final LinkedHashMap<String, Object> getPins() {
        LinkedHashMap<String, Object> pins = null;
        HashMap<String, Object> res = null;
        try {
            String url = API_PIN + "/ls?type=recursive";
            res = Cast.toLinkedHashMap(postForJsonReply(url, LinkedHashMap.class));
            // log.debug("RAW PINS LIST RESULT: " + XString.prettyPrint(res));

            if (res != null) {
                pins = Cast.toLinkedHashMap(res.get("Keys"));
            }
        } catch (Exception e) {
            log.error("Failed to get pins", e);
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
            String url = API_OBJECT + "/get?arg=" + hash + "&" + ENCODING_PARAM_NAME + "=" + encoding;
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
            String url = API_OBJECT + "/get?arg=" + hash + "&" + ENCODING_PARAM_NAME + "=" + encoding;

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

    /**
     * Returns JSON as string
     */
    public final String dagGet(String hash) {
        String ret = null;
        try {
            String url = API_DAG + "/get?arg=" + hash;
            ResponseEntity<String> result = restTemplate.getForEntity(new URI(url), String.class);
            ret = result.getBody();
            log.debug("RET: " + ret);
        } catch (Exception e) {
            log.error("Failed in restTemplate.getForEntity", e);
        }
        return ret;
    }

    public MerkleLink dagPutFromString(MongoSession session, String val, String mimeType,
            ValContainer<Integer> streamSize, ValContainer<String> cid) {
        return writeFromStream(session, API_DAG + "/put", IOUtils.toInputStream(val), null, streamSize, cid);
    }

    public MerkleLink dagPutFromStream(MongoSession session, InputStream stream, String mimeType,
            ValContainer<Integer> streamSize, ValContainer<String> cid) {
        return writeFromStream(session, API_DAG + "/put", stream, null, streamSize, cid);
    }

    public MerkleLink addFileFromString(MongoSession session, String text, String fileName, String mimeType,
            boolean wrapInFolder) {
        InputStream stream = IOUtils.toInputStream(text);
        try {
            return addFromStream(session, stream, fileName, mimeType, null, null, wrapInFolder);
        } finally {
            StreamUtil.close(stream);
        }
    }

    public MerkleLink addFileFromStream(MongoSession session, String fileName, InputStream stream, String mimeType,
            ValContainer<Integer> streamSize, ValContainer<String> cid) {
        return writeFromStream(session,
                API_FILES + "/write?arg=" + fileName + "&create=true&parents=true&truncate=true", stream, null,
                streamSize, cid);
    }

    public MerkleLink addFromStream(MongoSession session, InputStream stream, String fileName, String mimeType,
            ValContainer<Integer> streamSize, ValContainer<String> cid, boolean wrapInFolder) {
        String endpoint = API_BASE + "/add?stream-channels=true";
        if (wrapInFolder) {
            endpoint += "&wrap-with-directory=true";
        }
        return writeFromStream(session, endpoint, stream, fileName, streamSize, cid);
    }

    public Map<String, Object> addTarFromFile(String fileName) {
        adminRunner.run(mongoSession -> {
            try {
                addTarFromStream(mongoSession, new BufferedInputStream(new FileInputStream(fileName)), null, null);
            } catch (Exception e) {
                log.error("Failed in restTemplate.exchange", e);
            }
        });
        return null;
    }

    public MerkleLink addTarFromStream(MongoSession session, InputStream stream, ValContainer<Integer> streamSize,
            ValContainer<String> cid) {
        return writeFromStream(session, API_TAR + "/add", stream, null, streamSize, cid);
    }

    // https://medium.com/red6-es/uploading-a-file-with-a-filename-with-spring-resttemplate-8ec5e7dc52ca
    /*
     * todo-0: addition of 'fileName' is very new and very important here. Evaluate
     * everywhere we can pass this in and also check if there are ways we can avoid
     * the old need for mime guessing by always basing off extension on this
     * filename?
     */
    public MerkleLink writeFromStream(MongoSession session, String endpoint, InputStream stream, String fileName,
            ValContainer<Integer> streamSize, ValContainer<String> cid) {
        // log.debug("Writing file: " + path);
        MerkleLink ret = null;
        try {
            HttpHeaders headers = new HttpHeaders();

            MultiValueMap<String, Object> bodyMap = new LinkedMultiValueMap<>();
            LimitedInputStreamEx lis = new LimitedInputStreamEx(stream, session.getMaxUploadSize());
            bodyMap.add("file", makeFileEntity(lis, fileName));

            headers.setContentType(MediaType.MULTIPART_FORM_DATA);
            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(bodyMap, headers);

            ResponseEntity<String> response = restTemplate.exchange(endpoint, HttpMethod.POST, requestEntity,
                    String.class);
            MediaType contentType = response.getHeaders().getContentType();

            // log.debug("writeFromStream Raw Response: " + XString.prettyPrint(response));

            if (MediaType.APPLICATION_JSON.equals(contentType)) {
                if (StringUtils.isEmpty(response.getBody())) {
                    log.debug("no response body");
                } else {
                    ret = XString.jsonMapper.readValue(response.getBody(), MerkleLink.class);

                    // log.debug("writeFromStream Response JSON: " + XString.prettyPrint(ret));

                    if (cid != null) {
                        cid.setVal(ret.getHash());
                    }
                }
            }

            if (streamSize != null) {
                streamSize.setVal((int) lis.getCount());
            }
        } catch (Exception e) {
            log.error("Failed in restTemplate.exchange", e);
        }
        return ret;
    }

    // Creates a single file entry for a multipart file upload HTTP post
    public HttpEntity<InputStreamResource> makeFileEntity(InputStream is, String fileName) {
        if (StringUtils.isEmpty(fileName)) {
            fileName = "file";
        }
        MultiValueMap<String, String> fileMap = new LinkedMultiValueMap<>();
        ContentDisposition contentDisposition = ContentDisposition.builder("form-data").name("file").filename(fileName)
                .build();
        fileMap.add(HttpHeaders.CONTENT_DISPOSITION, contentDisposition.toString());
        HttpEntity<InputStreamResource> fileEntity = new HttpEntity<>(new InputStreamResource(is), fileMap);
        return fileEntity;
    }

    // todo-1: convert to actual type, not map.
    public Map<String, Object> ipnsPublish(MongoSession session, String key, String cid) {
        Map<String, Object> ret = null;
        try {
            String url = API_NAME + "/publish?arg=" + cid + "&=" + key;

            HttpHeaders headers = new HttpHeaders();
            MultiValueMap<String, Object> bodyMap = new LinkedMultiValueMap<>();
            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(bodyMap, headers);

            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, requestEntity, String.class);
            ret = mapper.readValue(response.getBody(), new TypeReference<Map<String, Object>>() {
            });

            // ret output:
            // {
            // "Name" : "QmYHQEW7NTczSxcaorguczFRNwAY1r7UkF8uU4FMTGMRJm",
            // "Value" : "/ipfs/bafyreibr77jhjmkltu7zcnyqwtx46fgacbjc7ayejcfp7yazxc6xt476xe"
            // }
        } catch (Exception e) {
            log.error("Failed in restTemplate.exchange", e);
        }
        return ret;
    }

    // todo-1: convert return val to a type (not map)
    public Map<String, Object> ipnsResolve(MongoSession session, String name) {
        Map<String, Object> ret = null;
        try {
            String url = API_NAME + "/resolve?arg=" + name;

            HttpHeaders headers = new HttpHeaders();
            MultiValueMap<String, Object> bodyMap = new LinkedMultiValueMap<>();
            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(bodyMap, headers);

            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, requestEntity, String.class);
            ret = mapper.readValue(response.getBody(), new TypeReference<Map<String, Object>>() {
            });

        } catch (Exception e) {
            log.error("Failed in restTemplate.exchange", e);
        }
        return ret;
    }

    public MerkleNode newObject() {
        return postToGetMerkleNode(API_OBJECT + "/new");
    }

    /*
     * Adds an existing CID into the directory strcture at rootCid, and returns the
     * new rootCid
     */
    public MerkleNode addFileToDagRoot(String rootCid, String filePath, String fileCid) {
        if (StringUtils.isEmpty(filePath)) {
            filePath = fileCid;
        }
        return postToGetMerkleNode(API_OBJECT + "/patch/add-link?arg=" + rootCid + "&arg=" + filePath + "&arg="
                + fileCid + "&create=true");
    }

    public MerkleNode postToGetMerkleNode(String endpoint) {
        MerkleNode ret = null;
        try {
            HttpHeaders headers = new HttpHeaders();
            MultiValueMap<String, Object> bodyMap = new LinkedMultiValueMap<>();
            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(bodyMap, headers);

            ResponseEntity<String> response = restTemplate.exchange(endpoint, HttpMethod.POST, requestEntity,
                    String.class);
            ret = mapper.readValue(response.getBody(), new TypeReference<MerkleNode>() {
            });
            // log.debug("new Object: " + XString.prettyPrint(ret));

        } catch (Exception e) {
            log.error("Failed in restTemplate.exchange", e);
        }
        return ret;
    }

    public IPFSDirStat pathStat(String path) {
        String url = API_FILES + "/stat?arg=" + path;
        return (IPFSDirStat) postForJsonReply(url, IPFSDirStat.class);
    }

    public IPFSObjectStat objectStat(String cid, boolean humanReadable) {
        String url = API_OBJECT + "/stat?arg=" + cid;
        if (humanReadable) {
            url += "&human=true";
        }
        return (IPFSObjectStat) postForJsonReply(url, IPFSObjectStat.class);
    }

    public String readFile(String path) {
        String url = API_FILES + "/read?arg=" + path;
        return (String) postForJsonReply(url, String.class);
    }

    public void streamResponse(HttpServletResponse response, MongoSession session, String hash, String mimeType) {
        BufferedInputStream inStream = null;
        BufferedOutputStream outStream = null;

        try {
            /*
             * To set contentType and contentLength here we'd need to read the entire stream
             * into byte array and get that info, and then use the byte array to stream the
             * result. For now things seem to work without us holding it all in memory which
             * is ideal
             */
            // response.setContentType(mimeTypeProp);
            // response.setContentLength((int) size);
            response.setHeader("Cache-Control", "public, max-age=31536000");

            inStream = new BufferedInputStream(getStream(session, hash));
            outStream = new BufferedOutputStream(response.getOutputStream());

            IOUtils.copy(inStream, outStream);
            outStream.flush();

        } catch (final Exception e) {
            log.error(e.getMessage());
        } finally {
            StreamUtil.close(inStream, outStream);
        }
    }

    public InputStream getStream(MongoSession session, String hash) {
        String sourceUrl = appProp.getIPFSGatewayHostAndPort() + "/ipfs/" + hash;

        try {
            int timeout = 20;
            RequestConfig config = RequestConfig.custom() //
                    .setConnectTimeout(timeout * 1000) //
                    .setConnectionRequestTimeout(timeout * 1000) //
                    .setSocketTimeout(timeout * 1000).build();

            HttpClient client = HttpClientBuilder.create().setDefaultRequestConfig(config).build();
            HttpGet request = new HttpGet(sourceUrl);

            request.addHeader("User-Agent", Const.FAKE_USER_AGENT);
            HttpResponse response = client.execute(request);
            InputStream is = response.getEntity().getContent();
            return is;
        } catch (Exception e) {
            log.error("getStream failed: sourceUrl", e);
            throw new RuntimeEx("Streaming failed.", e);
        }
    }

    public PublishNodeToIpfsResponse publishNodeToIpfs(MongoSession mongoSession, PublishNodeToIpfsRequest req) {
        if (!ThreadLocals.getSessionContext().isAdmin()) {
            throw ExUtil.wrapEx("admin only function.");
        }

        PublishNodeToIpfsResponse res = new PublishNodeToIpfsResponse();
        SyncToIpfsService svc = (SyncToIpfsService) SpringContextUtil.getBean(SyncToIpfsService.class);
        svc.writeIpfsFiles(mongoSession, req, res);
        return res;
    }

    public LoadNodeFromIpfsResponse loadNodeFromIpfs(MongoSession mongoSession, LoadNodeFromIpfsRequest req) {
        if (!ThreadLocals.getSessionContext().isAdmin()) {
            throw ExUtil.wrapEx("admin only function.");
        }

        LoadNodeFromIpfsResponse res = new LoadNodeFromIpfsResponse();
        SyncFromIpfsService svc = (SyncFromIpfsService) SpringContextUtil.getBean(SyncFromIpfsService.class);
        svc.writeNodes(mongoSession, req, res);
        return res;
    }

    public void dumpDir(String path, HashSet<String> allFilePaths) {
        // log.debug("dumpDir: " + path);
        IPFSDir dir = getDir(path);
        if (dir != null) {
            // log.debug("Dir: " + XString.prettyPrint(dir) + " EntryCount: " +
            // dir.getEntries().size());

            for (IPFSDirEntry entry : dir.getEntries()) {
                /*
                 * as a workaround to the IPFS bug, we rely on the logic of "if not a json file,
                 * it's a folder
                 */
                if (!entry.getName().endsWith(".json")) {
                    dumpDir(path + "/" + entry.getName(), allFilePaths);
                } else {
                    String fileName = path + "/" + entry.getName();
                    log.debug("dump: " + fileName);
                    // String readTest = readFile(fileName);
                    // log.debug("readTest: " + readTest);
                    if (allFilePaths != null) {
                        allFilePaths.add(fileName);
                    }
                }
            }
        }
    }

    public final Object postForJsonReply(String url, Class<?> clazz) {
        Object ret = null;
        try {
            // log.debug("post: " + url);
            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(null, null);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, requestEntity, String.class);

            // MediaType contentType = response.getHeaders().getContentType();
            // Warning: IPFS is inconsistent. Sometimes they return plain/text and sometimes
            // JSON in the contentType, so we just ignore it
            if (response.getStatusCode().value() == 200 /* && MediaType.APPLICATION_JSON.equals(contentType) */) {
                if (clazz == String.class) {
                    return response.getBody() == null ? "success" : response.getBody();
                } else {
                    // log.debug("postForJsonReply: " + response.getBody());
                    if (response.getBody() == null) {
                        ret = "success";
                    } else {
                        ret = XString.jsonMapper.readValue(response.getBody(), clazz);
                    }
                }
            }

        } catch (Exception e) {
            log.error("Failed in restTemplate.exchange", e);
        }
        return ret;
    }
}
