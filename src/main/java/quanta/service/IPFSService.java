package quanta.service;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.FileInputStream;
import java.io.InputStream;
import java.net.URI;
import java.net.URL;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
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
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import quanta.config.ServiceBase;
import quanta.config.SpringContextUtil;
import quanta.exception.base.RuntimeEx;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.model.ipfs.dag.DagNode;
import quanta.model.ipfs.dag.MerkleLink;
import quanta.model.ipfs.dag.MerkleNode;
import quanta.model.ipfs.file.IPFSDir;
import quanta.model.ipfs.file.IPFSDirEntry;
import quanta.model.ipfs.file.IPFSDirStat;
import quanta.model.ipfs.file.IPFSObjectStat;
import quanta.mongo.CreateNodeLocation;
import quanta.mongo.MongoRepository;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.request.LoadNodeFromIpfsRequest;
import quanta.request.PublishNodeToIpfsRequest;
import quanta.response.LoadNodeFromIpfsResponse;
import quanta.response.PublishNodeToIpfsResponse;
import quanta.util.Cast;
import quanta.util.Const;
import quanta.util.DateUtil;
import quanta.util.ExUtil;
import quanta.util.LimitedInputStreamEx;
import quanta.util.StreamUtil;
import quanta.util.ThreadLocals;
import quanta.util.Util;
import quanta.util.Val;
import quanta.util.XString;

// IPFS Reference: https://docs.ipfs.io/reference/http/api

/*
 * todo-2: There are several places in here where we're getting back a "String" from a
 * restTemplate.exchange for getting back JSON, and we can probably define a POJO and let the spring
 * converter convert do this for us always instead
 */

@Component
public class IPFSService extends ServiceBase {
    private static final Logger log = LoggerFactory.getLogger(IPFSService.class);

    public static String API_BASE;
    public static String API_CAT;
    public static String API_FILES;
    public static String API_PIN;
    public static String API_OBJECT;
    public static String API_DAG;
    public static String API_TAR;
    public static String API_NAME;
    public static String API_REPO;
    public static String API_PUBSUB;
    public static String API_SWARM;
    public static String API_CONFIG;
    public static String API_ID;

    private final ConcurrentHashMap<String, Boolean> failedCIDs = new ConcurrentHashMap<>();

    public LinkedHashMap<String, Object> instanceId = null;
    Object instanceIdLock = new Object();

    /*
     * originally this was 'data-endcoding' (or at least i got that from somewhere), but now their
     * example page seems to show 'encoding' is the name here.
     */
    public static String ENCODING_PARAM_NAME = "encoding";

    /*
     * RestTemplate is thread-safe and reusable, and has no state, so we need only one final static
     * instance ever
     */
    private static final RestTemplate restTemplate = new RestTemplate(Util.getClientHttpRequestFactory(10000));
    private static final RestTemplate restTemplateNoTimeout = new RestTemplate(Util.getClientHttpRequestFactory(0));
    private static final ObjectMapper mapper = new ObjectMapper();

    @PostConstruct
    public void init() {
        ipfs = this;
        
        API_BASE = prop.getIPFSApiHostAndPort() + "/api/v0";
        API_CAT = API_BASE + "/cat";
        API_FILES = API_BASE + "/files";
        API_PIN = API_BASE + "/pin";
        API_OBJECT = API_BASE + "/object";
        API_DAG = API_BASE + "/dag";
        API_TAR = API_BASE + "/tar";
        API_NAME = API_BASE + "/name";
        API_REPO = API_BASE + "/repo";
        API_PUBSUB = API_BASE + "/pubsub";
        API_SWARM = API_BASE + "/swarm";
        API_CONFIG = API_BASE + "/config";
        API_ID = API_BASE + "/id";
    }

    /* On regular interval forget which CIDs have failed and allow them to be retried */
    @Scheduled(fixedDelay = 10 * DateUtil.MINUTE_MILLIS)
    public void clearFailedCIDs() {
        if (!MongoRepository.fullInit)
            return;
        failedCIDs.clear();
    }

    public void doSwarmConnect() {
        arun.run(ms -> {
            List<String> adrsList = getSwarmConnectAddresses(ms);
            if (ok(adrsList)) {
                for (String adrs : adrsList) {
                    if (adrs.startsWith("/")) {
                        swarmConnect(adrs);
                    }
                }
            }
            return null;
        });
    }

    public List<String> getSwarmConnectAddresses(MongoSession ms) {
        List<String> ret = null;
        SubNode node = read.getNode(ms, ":ipfsSwarmAddresses");
        if (ok(node)) {
            log.debug("swarmAddresses: " + node.getContent());
            ret = XString.tokenize(node.getContent(), "\n", true);
        }
        return ret;
    }

    public String getRepoStat() {
        StringBuilder sb = new StringBuilder();
        LinkedHashMap<String, Object> res = null;

        res = Cast.toLinkedHashMap(postForJsonReply(API_REPO + "/stat?human=true", LinkedHashMap.class));
        sb.append("\nIPFS Repository Status:\n" + XString.prettyPrint(res) + "\n");

        res = Cast.toLinkedHashMap(postForJsonReply(API_CONFIG + "/show", LinkedHashMap.class));
        sb.append("\nIPFS Config:\n" + XString.prettyPrint(res) + "\n");

        res = Cast.toLinkedHashMap(postForJsonReply(API_ID, LinkedHashMap.class));
        sb.append("\nIPFS Instance ID:\n" + XString.prettyPrint(res) + "\n");

        // res = Cast.toLinkedHashMap(postForJsonReply(API_PUBSUB + "/peers?arg=" + topic,
        // LinkedHashMap.class));
        // sb.append("\nIPFS Peers for topic:\n" + XString.prettyPrint(res) + "\n");

        // res = Cast.toLinkedHashMap(postForJsonReply(API_PUBSUB + "/ls", LinkedHashMap.class));
        // sb.append("\nIPFS Topics List:\n" + XString.prettyPrint(res) + "\n");

        return sb.toString();
    }

    /*
     * this appears to be broken due to a bug in IPFS? Haven't reported an error to them yet. Returns
     * HTTP success (200), but no data. It should be returnin JSON but doesn't, so I have hacked the
     * postForJsonReply to always return 'success' in this scenario (200 with no body)
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
        // casting to a string now, because a bug in IPFS is making it not return data,
        // so we get back string "success"
        String res = (String) postForJsonReply(url, String.class);
        return "\nIPFS Pin Verify:\n" + XString.prettyPrint(res) + "\n";
    }

    public String getRepoGC() {
        String url = API_REPO + "/gc";
        // LinkedHashMap<String, Object> res = Cast.toLinkedHashMap(postForJsonReply(url,
        // LinkedHashMap.class));
        // return "\nIPFS Repository Garbage Collect:\n" + XString.prettyPrint(res) + "\n";
        String res = (String) postForJsonReply(url, String.class);
        return "\nIPFS Repository Garbage Collect:\n" + res + "\n";
    }

    public LinkedHashMap<String, Object> getInstanceId() {
        synchronized (instanceIdLock) {
            if (no(instanceId)) {
                instanceId = Cast.toLinkedHashMap(postForJsonReply(API_ID, LinkedHashMap.class));
            }
            return instanceId;
        }
    }

    public void ipfsAsyncPinNode(MongoSession ms, ObjectId nodeId) {
        asyncExec.run(ThreadLocals.getContext(), () -> {
            // wait for node to be saved. Waits up to 30 seconds, because of the 10 retries.
            /*
             * todo-2: What we could do here instead of what is essentially polling we're doing is hook into the
             * MongoEventListener class and have a pub/sub model in effect so we can detect immediately when the
             * node is saved.
             */
            Util.sleep(3000);
            SubNode node = read.getNode(ms, nodeId, false, 10);

            if (no(node))
                return;
            String ipfsLink = node.getStr(NodeProp.IPFS_LINK);
            addPin(ipfsLink);

            // always get bytes here from IPFS, and update the node prop with that too.
            IPFSObjectStat stat = objectStat(ipfsLink, false);

            // note: the enclosing scope this we're running in will take care of comitting the node change to
            // the db.
            node.set(NodeProp.BIN_SIZE.s(), stat.getCumulativeSize());

            /* And finally update this user's quota for the added storage */
            SubNode accountNode = read.getUserNodeByUserName(ms, null);
            if (ok(accountNode)) {
                user.addBytesToUserNodeBytes(ms, stat.getCumulativeSize(), accountNode, 1);
            }
        });
    }

    /* Ensures this node's attachment is saved to IPFS and returns the CID of it */
    public String saveNodeAttachmentToIpfs(MongoSession ms, SubNode node) {
        String cid = null;
        String mime = node.getStr(NodeProp.BIN_MIME);
        String fileName = node.getStr(NodeProp.BIN_FILENAME);

        InputStream is = attach.getStreamByNode(node, "");
        if (ok(is)) {
            try {
                MerkleLink ret = addFromStream(ms, is, fileName, mime, null, null, false);
                if (ok(ret)) {
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
     * Reads the bytes from 'ipfs hash', expecting them to be UTF-8 and returns the string.
     * 
     * NOTE: The hash is allowed to have a subpath here.
     */
    public String catToString(String hash) {
        String ret = null;
        try {
            String url = API_CAT + "?arg=" + hash;
            ResponseEntity<String> response =
                    restTemplate.exchange(url, HttpMethod.POST, Util.getBasicRequestEntity(), String.class);
            ret = response.getBody();
            // log.debug("IPFS post cat. Ret " + response.getStatusCode() + "] " + ret);
        } catch (Exception e) {
            log.error("Failed to cat: " + hash, e);
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

    public IPFSDir getDir(String path) {
        String url = API_FILES + "/ls?arg=" + path + "&long=true";
        return (IPFSDir) postForJsonReply(url, IPFSDir.class);
    }

    public boolean removePin(String cid) {
        // log.debug("Remove Pin: " + cid);
        String url = API_PIN + "/rm?arg=" + cid;
        return ok(postForJsonReply(url, Object.class));
    }

    public boolean addPin(String cid) {
        // log.debug("Add Pin: " + cid);
        String url = API_PIN + "/add?arg=" + cid;
        return ok(postForJsonReply(url, Object.class));
    }

    /* Deletes the file or if a folder deletes it recursively */
    public boolean deletePath(String path) {
        String url = API_FILES + "/rm?arg=" + path + "&force=true";
        return ok(postForJsonReply(url, Object.class));
    }

    public boolean flushFiles(String path) {
        String url = API_FILES + "/flush?arg=" + path;
        return ok(postForJsonReply(url, Object.class));
    }

    public LinkedHashMap<String, Object> getPins() {
        LinkedHashMap<String, Object> pins = null;
        HashMap<String, Object> res = null;
        try {
            String url = API_PIN + "/ls?type=recursive";
            res = Cast.toLinkedHashMap(postForJsonReply(url, LinkedHashMap.class));
            // log.debug("RAW PINS LIST RESULT: " + XString.prettyPrint(res));

            if (ok(res)) {
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
     * @return MerkleNode of the hash, as requested usingn the 'encoding=' url argument specified.
     */
    public MerkleNode getMerkleNode(String hash, String encoding) {
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
     * Returns string of the the hash get, as requested usingn the 'encoding=' url argument specified.
     */
    public String getAsString(String hash, String encoding) {
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
    public String dagGet(String hash) {
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

    public DagNode getDagNode(String cid) {
        DagNode ret = null;
        try {
            String url = API_DAG + "/get?arg=" + cid;
            ret = (DagNode) postForJsonReply(url, DagNode.class);
        } catch (Exception e) {
            log.error("Failed in getDagNode", e);
        }
        return ret;
    }

    public MerkleLink dagPutFromString(MongoSession ms, String val, String mimeType, Val<Integer> streamSize, Val<String> cid) {
        return writeFromStream(ms, API_DAG + "/put", IOUtils.toInputStream(val), null, streamSize, cid);
    }

    public MerkleLink dagPutFromStream(MongoSession ms, InputStream stream, String mimeType, Val<Integer> streamSize,
            Val<String> cid) {
        return writeFromStream(ms, API_DAG + "/put", stream, null, streamSize, cid);
    }

    public MerkleLink addFileFromString(MongoSession ms, String text, String fileName, String mimeType, boolean wrapInFolder) {
        InputStream stream = IOUtils.toInputStream(text);
        try {
            return addFromStream(ms, stream, fileName, mimeType, null, null, wrapInFolder);
        } finally {
            StreamUtil.close(stream);
        }
    }

    public MerkleLink addFileFromStream(MongoSession ms, String fileName, InputStream stream, String mimeType,
            Val<Integer> streamSize) {
        // NOTE: the 'write' endpoint doesn't send back any data (no way to get the CID back)
        return writeFromStream(ms, API_FILES + "/write?arg=" + fileName + "&create=true&parents=true&truncate=true", stream, null,
                streamSize, null);
    }

    /*
     * NOTE: Default behavior according to IPFS docs is that without the 'pin' argument on this call it
     * DOES pin the file
     */
    public MerkleLink addFromStream(MongoSession ms, InputStream stream, String fileName, String mimeType,
            Val<Integer> streamSize, Val<String> cid, boolean wrapInFolder) {
        String endpoint = API_BASE + "/add?stream-channels=true";
        if (wrapInFolder) {
            endpoint += "&wrap-with-directory=true";
        }
        return writeFromStream(ms, endpoint, stream, fileName, streamSize, cid);
    }

    public Map<String, Object> addTarFromFile(String fileName) {
        arun.run(mongoSession -> {
            try {
                addTarFromStream(mongoSession, new BufferedInputStream(new FileInputStream(fileName)), null, null);
            } catch (Exception e) {
                log.error("Failed in restTemplate.exchange", e);
            }
            return null;
        });
        return null;
    }

    public MerkleLink addTarFromStream(MongoSession ms, InputStream stream, Val<Integer> streamSize, Val<String> cid) {
        return writeFromStream(ms, API_TAR + "/add", stream, null, streamSize, cid);
    }

    // https://medium.com/red6-es/uploading-a-file-with-a-filename-with-spring-resttemplate-8ec5e7dc52ca
    /*
     * todo-2: addition of 'fileName' is very new and very important here. Evaluate everywhere we can
     * pass this in and also check if there are ways we can avoid the old need for mime guessing by
     * always basing off extension on this filename?
     */
    public MerkleLink writeFromStream(MongoSession ms, String endpoint, InputStream stream, String fileName,
            Val<Integer> streamSize, Val<String> cid) {
        // log.debug("Writing file: " + path);
        MerkleLink ret = null;
        try {
            HttpHeaders headers = new HttpHeaders();

            MultiValueMap<String, Object> bodyMap = new LinkedMultiValueMap<>();
            LimitedInputStreamEx lis = new LimitedInputStreamEx(stream, user.getMaxUploadSize(ms));
            bodyMap.add("file", makeFileEntity(lis, fileName));

            headers.setContentType(MediaType.MULTIPART_FORM_DATA);
            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(bodyMap, headers);

            ResponseEntity<String> response = restTemplate.exchange(endpoint, HttpMethod.POST, requestEntity, String.class);
            MediaType contentType = response.getHeaders().getContentType();

            log.debug("writeFromStream Raw Response: " + XString.prettyPrint(response));

            if (MediaType.APPLICATION_JSON.equals(contentType)) {
                if (StringUtils.isEmpty(response.getBody())) {
                    log.debug("no response body");
                } else {
                    ret = XString.jsonMapper.readValue(response.getBody(), MerkleLink.class);

                    // log.debug("writeFromStream Response JSON: " + XString.prettyPrint(ret));

                    if (ok(cid)) {
                        cid.setVal(ret.getHash());
                    }
                }
            }

            if (ok(streamSize)) {
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
        ContentDisposition contentDisposition = ContentDisposition.builder("form-data").name("file").filename(fileName).build();
        fileMap.add(HttpHeaders.CONTENT_DISPOSITION, contentDisposition.toString());
        HttpEntity<InputStreamResource> fileEntity = new HttpEntity<>(new InputStreamResource(is), fileMap);
        return fileEntity;
    }

    // todo-2: convert to actual type, not map.
    public Map<String, Object> ipnsPublish(MongoSession ms, String key, String cid) {
        Map<String, Object> ret = null;
        try {
            String url = API_NAME + "/publish?arg=" + cid + (ok(key) ? "&=" + key : "");

            HttpHeaders headers = new HttpHeaders();
            MultiValueMap<String, Object> bodyMap = new LinkedMultiValueMap<>();
            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(bodyMap, headers);

            // Use a rest call with no timeout becasue publish can take a LONG time.
            ResponseEntity<String> response = restTemplateNoTimeout.exchange(url, HttpMethod.POST, requestEntity, String.class);
            ret = mapper.readValue(response.getBody(), new TypeReference<Map<String, Object>>() {});

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

    // todo-2: convert return val to a type (not map)
    public Map<String, Object> ipnsResolve(MongoSession ms, String name) {
        Map<String, Object> ret = null;
        try {
            String url = API_NAME + "/resolve?arg=" + name;

            HttpHeaders headers = new HttpHeaders();
            MultiValueMap<String, Object> bodyMap = new LinkedMultiValueMap<>();
            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(bodyMap, headers);

            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, requestEntity, String.class);
            ret = mapper.readValue(response.getBody(), new TypeReference<Map<String, Object>>() {});

        } catch (Exception e) {
            log.error("Failed in restTemplate.exchange", e);
        }
        return ret;
    }

    public Map<String, Object> swarmConnect(String peer) {
        Map<String, Object> ret = null;
        try {
            log.debug("Swarm connect: " + peer);
            String url = API_SWARM + "/connect?arg=" + peer;

            HttpHeaders headers = new HttpHeaders();
            MultiValueMap<String, Object> bodyMap = new LinkedMultiValueMap<>();
            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(bodyMap, headers);

            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, requestEntity, String.class);
            ret = mapper.readValue(response.getBody(), new TypeReference<Map<String, Object>>() {});
            log.debug("IPFS swarm connect: " + XString.prettyPrint(ret));
        } catch (Exception e) {
            log.error("Failed in restTemplate.exchange", e);
        }
        return ret;
    }

    // PubSub List peers
    public Map<String, Object> swarmPeers() {
        Map<String, Object> ret = null;
        try {
            String url = API_SWARM + "/peers";

            HttpHeaders headers = new HttpHeaders();
            MultiValueMap<String, Object> bodyMap = new LinkedMultiValueMap<>();
            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(bodyMap, headers);

            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, requestEntity, String.class);
            ret = mapper.readValue(response.getBody(), new TypeReference<Map<String, Object>>() {});
            log.debug("IPFS swarm peers: " + XString.prettyPrint(ret));
        } catch (Exception e) {
            log.error("Failed in restTemplate.exchange", e);
        }
        return ret;
    }

    public MerkleNode newObject() {
        return postToGetMerkleNode(API_OBJECT + "/new");
    }

    /*
     * Adds an existing CID into the directory strcture at rootCid, and returns the new rootCid
     */
    public MerkleNode addFileToDagRoot(String rootCid, String filePath, String fileCid) {
        if (StringUtils.isEmpty(filePath)) {
            filePath = fileCid;
        }
        return postToGetMerkleNode(
                API_OBJECT + "/patch/add-link?arg=" + rootCid + "&arg=" + filePath + "&arg=" + fileCid + "&create=true");
    }

    /*
     * Creates a node holding this CID in the current user (SessionContext) account under their EXPORTS
     * node type.
     * 
     * todo-2: need to document this (and how user must delete the export node to release their pins) in
     * the User Guide
     *
     * Note: childerenFiles will be all the files linked into this resource under a common DAG, and we
     * have to add them here, primarily to ensure garbage collector will keep them, but secondly it's a
     * nice-feature for user to be able to browse them individually.
     */
    public void writeIpfsExportNode(MongoSession ms, String cid, String mime, String fileName,
            List<ExportIpfsFile> childrenFiles) {
        SubNode exportParent =
                read.getUserNodeByType(ms, ms.getUserName(), null, "### Exports", NodeType.EXPORTS.s(), null, null);

        if (ok(exportParent)) {
            SubNode node =
                    create.createNode(ms, exportParent, null, NodeType.NONE.s(), 0L, CreateNodeLocation.FIRST, null, null, true);

            node.setOwner(exportParent.getOwner());
            // use export filename here
            node.setContent("IPFS Export: " + cid + "\n\nMime: " + mime);
            node.touch();
            node.set(NodeProp.IPFS_LINK.s(), cid);
            node.set(NodeProp.BIN_MIME.s(), mime);
            node.set(NodeProp.BIN_FILENAME.s(), fileName);
            update.save(ms, node);

            if (ok(childrenFiles)) {
                for (ExportIpfsFile file : childrenFiles) {
                    SubNode child =
                            create.createNode(ms, node, null, NodeType.NONE.s(), 0L, CreateNodeLocation.LAST, null, null, true);

                    child.setOwner(exportParent.getOwner());
                    child.setContent("IPFS File: " + file.getFileName() + "\n\nMime: " + file.getMime());
                    child.touch();
                    child.set(NodeProp.IPFS_LINK.s(), file.getCid());
                    child.set(NodeProp.BIN_MIME.s(), file.getMime());
                    child.set(NodeProp.BIN_FILENAME.s(), file.getFileName());
                    child.set(NodeProp.IMG_SIZE.s(), "200px");
                    update.save(ms, child);
                }
            }
        }
    }

    public MerkleNode postToGetMerkleNode(String endpoint) {
        MerkleNode ret = null;
        try {
            HttpHeaders headers = new HttpHeaders();
            MultiValueMap<String, Object> bodyMap = new LinkedMultiValueMap<>();
            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(bodyMap, headers);

            ResponseEntity<String> response = restTemplate.exchange(endpoint, HttpMethod.POST, requestEntity, String.class);
            ret = mapper.readValue(response.getBody(), new TypeReference<MerkleNode>() {});
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

    public void streamResponse(HttpServletResponse response, MongoSession ms, String hash, String mimeType) {
        BufferedInputStream inStream = null;
        BufferedOutputStream outStream = null;

        try {
            /*
             * To set contentType and contentLength here we'd need to read the entire stream into byte array and
             * get that info, and then use the byte array to stream the result. For now things seem to work
             * without us holding it all in memory which is ideal
             */
            // response.setContentType(mimeTypeProp);
            // response.setContentLength((int) size);
            response.setHeader("Cache-Control", "public, max-age=31536000");

            inStream = new BufferedInputStream(getStream(ms, hash));
            outStream = new BufferedOutputStream(response.getOutputStream());

            IOUtils.copy(inStream, outStream);
            outStream.flush();

        } catch (final Exception e) {
            log.error(e.getMessage());
        } finally {
            StreamUtil.close(inStream, outStream);
        }
    }

    public InputStream getStream(MongoSession ms, String hash) {
        if (ok(failedCIDs.get(hash))) {
            // log.debug("Abort CID already failed: " + hash);
            throw new RuntimeException("failed CIDs: " + hash);
        }

        String sourceUrl = prop.getIPFSGatewayHostAndPort() + "/ipfs/" + hash;

        try {
            int timeout = 15;
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
            failedCIDs.put(hash, true);
            log.error("getStream failed: " + sourceUrl, e);
            throw new RuntimeEx("Streaming failed.", e);
        }
    }

    public PublishNodeToIpfsResponse publishNodeToIpfs(MongoSession ms, PublishNodeToIpfsRequest req) {
        if (!ThreadLocals.getSC().isAdmin()) {
            throw ExUtil.wrapEx("admin only function.");
        }

        PublishNodeToIpfsResponse res = new PublishNodeToIpfsResponse();
        SyncToIpfsService svc = (SyncToIpfsService) SpringContextUtil.getBean(SyncToIpfsService.class);
        svc.writeIpfsFiles(ms, req, res);
        return res;
    }

    public LoadNodeFromIpfsResponse loadNodeFromIpfs(MongoSession ms, LoadNodeFromIpfsRequest req) {
        if (!ThreadLocals.getSC().isAdmin()) {
            throw ExUtil.wrapEx("admin only function.");
        }

        LoadNodeFromIpfsResponse res = new LoadNodeFromIpfsResponse();
        SyncFromIpfsService svc = (SyncFromIpfsService) SpringContextUtil.getBean(SyncFromIpfsService.class);
        svc.writeNodes(ms, req, res);
        return res;
    }

    /* This has a side effect of deleting empty directories */
    public void traverseDir(String path, HashSet<String> allFilePaths) {
        log.debug("dumpDir: " + path);
        IPFSDir dir = getDir(path);
        if (ok(dir)) {
            log.debug("Dir: " + XString.prettyPrint(dir));

            if (no(dir.getEntries())) {
                log.debug("DEL EMPTY FOLDER: " + path);
                deletePath(path);
                return;
            }

            for (IPFSDirEntry entry : dir.getEntries()) {
                String entryPath = path + "/" + entry.getName();

                // entries with 0 size are folders
                if (entry.getSize() == 0) {
                    traverseDir(entryPath, allFilePaths);
                } else {
                    /*
                     * as a workaround to the IPFS bug, we rely on the logic of "if not a json file, it's a folder
                     */
                    if (!entry.getName().endsWith(".json")) {
                        traverseDir(entryPath, allFilePaths);
                    } else {
                        log.debug("dump: " + entryPath);
                        // String readTest = readFile(entryPath);
                        // log.debug("readTest: " + readTest);
                        if (ok(allFilePaths)) {
                            allFilePaths.add(entryPath);
                        }
                    }
                }
            }
        }
    }

    public Object postForJsonReply(String url, Class<?> clazz) {
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
                    return no(response.getBody()) ? "success" : response.getBody();
                } else {
                    // log.debug("postForJsonReply: " + response.getBody());
                    if (no(response.getBody())) {
                        ret = "success";
                    } else {
                        ret = XString.jsonMapper.readValue(response.getBody(), clazz);
                    }
                }
            }

        } catch (Exception e) {
            // Don't show this. Sometimes we try to read a file to see if it's present or not.
            // log.error("Failed in restTemplate.exchange", e);
        }
        return ret;
    }
}
