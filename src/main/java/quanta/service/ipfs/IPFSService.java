package quanta.service.ipfs;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.apache.commons.io.IOUtils;
import org.apache.commons.lang3.StringUtils;
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
import jakarta.servlet.http.HttpServletResponse;
import quanta.actpub.model.APODID;
import quanta.config.ServiceBase;
import quanta.config.SessionContext;
import quanta.model.UserStats;
import quanta.model.client.Attachment;
import quanta.model.client.Constant;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.model.ipfs.dag.DagNode;
import quanta.model.ipfs.dag.MerkleLink;
import quanta.model.ipfs.file.IPFSDirStat;
import quanta.mongo.CreateNodeLocation;
import quanta.mongo.MongoRepository;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.request.LoadNodeFromIpfsRequest;
import quanta.request.PublishNodeToIpfsRequest;
import quanta.response.LoadNodeFromIpfsResponse;
import quanta.response.PublishNodeToIpfsResponse;
import quanta.response.PushPageMessage;
import quanta.service.exports.ExportIpfsFile;
import quanta.service.mfs.SyncFromMFSService;
import quanta.service.mfs.SyncToMFSService;
import quanta.util.DateUtil;
import quanta.util.LimitedInputStreamEx;
import quanta.util.StreamUtil;
import quanta.util.ThreadLocals;
import quanta.util.Util;
import quanta.util.XString;
import quanta.util.val.Val;

// IPFS Reference: https://docs.ipfs.io/reference/http/api
@Component
public class IPFSService extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(IPFSService.class);
    public static String API_ID;
    public final ConcurrentHashMap<String, Boolean> failedCIDs = new ConcurrentHashMap<>();
    public LinkedHashMap<String, Object> instanceId = null;
    Object instanceIdLock = new Object();
    /*
     * originally this was 'data-endcoding' (or at least i got that from somewhere), but now their
     * example page seems to show 'encoding' is the name here.
     */
    public String ENCODING_PARAM_NAME = "encoding";
    /*
     * RestTemplate is thread-safe and reusable, and has no state, so we need only one final static
     * instance ever
     */
    public final RestTemplate restTemplate = new RestTemplate();
    public final RestTemplate restTemplateNoTimeout = new RestTemplate();

    @Override
    public void postConstruct() {
        API_ID = prop.getIPFSApiBase() + "/id";
    }

    /* On regular interval forget which CIDs have failed and allow them to be retried */
    @Scheduled(fixedDelay = 10 * DateUtil.MINUTE_MILLIS)
    public void clearFailedCIDs() {
        if (!initComplete && !MongoRepository.fullInit)
            return;
        failedCIDs.clear();
    }

    public LinkedHashMap<String, Object> getInstanceId() {
        if (!prop.ipfsEnabled())
            return null;
        synchronized (instanceIdLock) {
            if (instanceId == null) {
                instanceId = toLinkedHashMap(postForJsonReply(API_ID, LinkedHashMap.class));
            }
            return instanceId;
        }
    }

    /* Ensures this node's attachment is saved to IPFS and returns the CID of it */
    public String saveNodeAttachmentToIpfs(MongoSession ms, SubNode node) {
        checkIpfs();
        // todo-2: this is not yet handling multiple images. It's ok IPFS is on the back burner right now.
        Attachment att = node.getFirstAttachment();
        String cid = null;
        String mime = att != null ? att.getMime() : null;
        String fileName = att != null ? att.getFileName() : null;
        InputStream is = attach.getStreamByNode(node, "");
        if (is != null) {
            try {
                MerkleLink ret = addFromStream(ms, is, fileName, mime, null, false);
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

    public MerkleLink addFileFromString(MongoSession ms, String text, String fileName, String mimeType,
            boolean wrapInFolder) {
        checkIpfs();
        InputStream stream = IOUtils.toInputStream(text, StandardCharsets.UTF_8);
        try {
            return addFromStream(ms, stream, fileName, mimeType, null, wrapInFolder);
        } finally {
            StreamUtil.close(stream);
        }
    }

    /*
     * NOTE: Default behavior according to IPFS docs is that without the 'pin' argument on this call it
     * DOES pin the file
     */
    public MerkleLink addFromStream(MongoSession ms, InputStream stream, String fileName, String mimeType,
            Val<Integer> streamSize, boolean wrapInFolder) {
        checkIpfs();
        String endpoint = prop.getIPFSApiBase() + "/add?stream-channels=true";
        if (wrapInFolder) {
            endpoint += "&wrap-with-directory=true";
        }
        return writeFromStream(ms, endpoint, stream, fileName, streamSize);
    }

    // public Map<String, Object> addTarFromFile(String fileName) {
    // arun.run(as -> {
    // try {
    // addTarFromStream(as, new BufferedInputStream(new FileInputStream(fileName)), null, null);
    // } catch (Exception e) {
    // log.error("Failed in restTemplate.exchange", e);
    // }
    // return null;
    // });
    // return null;
    // }
    // public MerkleLink addTarFromStream(MongoSession ms, InputStream stream, Val<Integer> streamSize,
    // Val<String> cid) {
    // return writeFromStream(ms, API_TAR + "/add", stream, null, streamSize, cid);
    // }
    // https://medium.com/red6-es/uploading-a-file-with-a-filename-with-spring-resttemplate-8ec5e7dc52ca
    /*
     * todo-2: addition of 'fileName' is very new and very important here. Evaluate everywhere we can
     * pass this in and also check if there are ways we can avoid the old need for mime guessing by
     * always basing off extension on this filename?
     */
    public MerkleLink writeFromStream(MongoSession ms, String endpoint, InputStream stream, String fileName,
            Val<Integer> streamSize) {
        checkIpfs();
        MerkleLink ret = null;
        try {
            HttpHeaders headers = new HttpHeaders();
            MultiValueMap<String, Object> bodyMap = new LinkedMultiValueMap<>();
            LimitedInputStreamEx lis = new LimitedInputStreamEx(stream, user.getUserStorageRemaining(ms));
            bodyMap.add("file", makeFileEntity(lis, fileName));
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);
            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(bodyMap, headers);
            ResponseEntity<String> response =
                    restTemplate.exchange(endpoint, HttpMethod.POST, requestEntity, String.class);
            if (response.getStatusCodeValue() != 200) {
                throw new RuntimeException("Failed. StatusCode: " + response.getStatusCode());
            }
            // MediaType contentType = response.getHeaders().getContentType();
            log.debug("writeFromStream Raw Response: " + XString.prettyPrint(response));
            if (StringUtils.isEmpty(response.getBody())) {
                log.debug("no response body");
            } else {
                String body = response.getBody();
                try {
                    ret = Util.mapper.readValue(body, MerkleLink.class);
                } catch (Exception e) {
                }
                // some calls, like the mfs file add, don't send back the MerkleLink, so for now let's just tolerate
                // that until we design better around it, and return a null.
                // log.debug("Unable to parse response string: " + body);
                // log.debug("writeFromStream Response JSON: " + XString.prettyPrint(ret));
            }
            if (streamSize != null) {
                streamSize.setVal((int) lis.getCount());
            }
        } catch (Exception e) {
            log.error("Failed in restTemplate.exchange", e);
            throw e;
        }
        return ret;
    }

    // Creates a single file entry for a multipart file upload HTTP post
    public HttpEntity<InputStreamResource> makeFileEntity(InputStream is, String fileName) {
        checkIpfs();
        if (StringUtils.isEmpty(fileName)) {
            fileName = "file";
        }
        MultiValueMap<String, String> fileMap = new LinkedMultiValueMap<>();
        ContentDisposition contentDisposition =
                ContentDisposition.builder("form-data").name("file").filename(fileName).build();
        fileMap.add(HttpHeaders.CONTENT_DISPOSITION, contentDisposition.toString());
        HttpEntity<InputStreamResource> fileEntity = new HttpEntity<>(new InputStreamResource(is), fileMap);
        return fileEntity;
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
        checkIpfs();
        SubNode exportParent = read.getUserNodeByType(ms, ms.getUserName(), null, "### Exports", NodeType.EXPORTS.s(),
                null, null, false);
        if (exportParent != null) {
            SubNode node = create.createNode(ms, exportParent, null, NodeType.NONE.s(), 0L, CreateNodeLocation.FIRST,
                    null, null, true, true);
            // todo-2: make this handle multiple attachments, and all calls to it
            Attachment att = node.getAttachment(Constant.ATTACHMENT_PRIMARY.s(), true, false);
            node.setOwner(exportParent.getOwner());
            // use export filename here
            node.setContent("IPFS Export: " + cid + "\n\nMime: " + mime);
            node.touch();
            att.setIpfsLink(cid);
            att.setMime(mime);
            att.setFileName(fileName);
            update.save(ms, node);
            if (childrenFiles != null) {
                for (ExportIpfsFile file : childrenFiles) {
                    SubNode child = create.createNode(ms, node, null, NodeType.NONE.s(), 0L, CreateNodeLocation.LAST,
                            null, null, true, true);
                    // todo-2: make this handle multiple attachments, and all calls to it
                    Attachment childAtt = child.getAttachment(Constant.ATTACHMENT_PRIMARY.s(), true, false);
                    child.setOwner(exportParent.getOwner());
                    child.setContent("IPFS File: " + file.getFileName() + "\n\nMime: " + file.getMime());
                    child.touch();
                    childAtt.setIpfsLink(file.getCid());
                    childAtt.setMime(file.getMime());
                    childAtt.setFileName(file.getFileName());
                    childAtt.setCssSize("200px");
                    update.save(ms, child);
                }
            }
        }
    }

    public void streamResponse(HttpServletResponse response, MongoSession ms, String hash, String mimeType) {
        checkIpfs();
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

    @SuppressWarnings("unused")
    public InputStream getStream(MongoSession ms, String hash) {
        // todo-1: Spring 3 took away HttpClient
        if (true) {
            throw new RuntimeException("This feature is temporarily disabled");
        }
        return null;
        // checkIpfs();
        // if (failedCIDs.get(hash) != null) {
        // throw new RuntimeException("failed CIDs: " + hash);
        // }
        // String sourceUrl = prop.getIPFSGatewayHostAndPort() + "/ipfs/" + hash;
        // try {
        // int timeout = 15;
        // RequestConfig config = //
        // //
        // //
        // RequestConfig.custom().setConnectTimeout(timeout * 1000).setConnectionRequestTimeout(timeout *
        // 1000)
        // .setSocketTimeout(timeout * 1000).build();
        // HttpClient client = HttpClientBuilder.create().setDefaultRequestConfig(config).build();
        // HttpGet request = new HttpGet(sourceUrl);
        // request.addHeader("User-Agent", Const.FAKE_USER_AGENT);
        // HttpResponse response = client.execute(request);
        // InputStream is = response.getEntity().getContent();
        // return is;
        // } catch (Exception e) {
        // failedCIDs.put(hash, true);
        // log.error("getStream failed: " + sourceUrl, e);
        // throw new RuntimeEx("Streaming failed.", e);
        // }
    }

    public PublishNodeToIpfsResponse publishNodeToIpfs(MongoSession ms, PublishNodeToIpfsRequest req) {
        checkIpfs();
        ThreadLocals.requireAdmin();
        PublishNodeToIpfsResponse res = new PublishNodeToIpfsResponse();
        SyncToMFSService svc = (SyncToMFSService) context.getBean(SyncToMFSService.class);
        svc.writeIpfsFiles(ms, req, res);
        return res;
    }

    public LoadNodeFromIpfsResponse loadNodeFromIpfs(MongoSession ms, LoadNodeFromIpfsRequest req) {
        checkIpfs();
        ThreadLocals.requireAdmin();
        LoadNodeFromIpfsResponse res = new LoadNodeFromIpfsResponse();
        SyncFromMFSService svc = (SyncFromMFSService) context.getBean(SyncFromMFSService.class);
        svc.writeNodes(ms, req, res);
        return res;
    }

    public Object postForJsonReply(String url, Class<?> clazz) {
        checkIpfs();
        Object ret = null;
        try {
            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(null, null);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, requestEntity, String.class);
            // MediaType contentType = response.getHeaders().getContentType();
            // Warning: IPFS is inconsistent. Sometimes they return plain/text and sometimes
            // JSON in the contentType, so we just ignore it
            if (response.getStatusCode().value() == 200/* && MediaType.APPLICATION_JSON.equals(contentType) */) {
                String body = response.getBody();
                if (clazz == String.class) {
                    return response.getBody() == null ? "success" : body;
                } else {
                    if (body == null) {
                        ret = "success";
                    } else {
                        try {
                            ret = Util.mapper.readValue(response.getBody(), clazz);
                        } catch (Exception e) {
                            log.error("Failed to parse body: " + body + " to class " + clazz.getName(), e);
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.error("Failed in restTemplate.exchange", e);
        }
        return ret;
    }

    public DagNode toDagNode(Object obj) {
        return (DagNode) obj;
    }

    /* Convert to hashmap of String to Object */
    @SuppressWarnings("unchecked")
    public LinkedHashMap<String, Object> toLinkedHashMap(Object obj) {
        return (LinkedHashMap<String, Object>) obj;
    }

    /*
     * Save PUBLIC nodes to IPFS/MFS
     */
    @SuppressWarnings("unused")
    public void saveNodeToMFS(MongoSession ms, SubNode node) {
        if (!ThreadLocals.getSC().allowWeb3()) {
            return;
        }
        // Note: we need to access the current thread, because the rest of the logic runs in a damon thread.
        String userNodeId = ThreadLocals.getSC().getUserNodeId();
        exec.run(() -> {
            arun.run(as -> {
                SubNode ownerNode = read.getNode(as, node.getOwner());
                // only write out files if user has MFS enabled in their UserProfile
                if (!ownerNode.getBool(NodeProp.MFS_ENABLE)) {
                    return null;
                }

                if (ownerNode == null) {
                    throw new RuntimeException("Unable to find owner node.");
                }
                String pathBase = "/" + userNodeId;
                // **** DO NOT DELETE *** (this code works and is how we could use the 'path' to store our files,
                // for a tree on a user's MFS area
                // but what we do instead is take the NAME of the node, and use that is the filename, and write
                // directly into '[user]/posts/[name]' loation
                // // make the path of the node relative to the owner by removing the part of the path that is
                // // the user's root node path
                // String path = node.getPath().replace(ownerNode.getPath(), "");
                // path = folderizePath(path);
                // If this gets to be too many files for IPFS to handle, we can always include a year and month, and
                // that would probably
                // at least create a viable system, proof-of-concept
                String path = "/" + node.getName() + ".txt";
                String mfsPath = pathBase + "/posts" + path;
                // save values for finally block
                String mcid = node.getMcid();
                String prevMcid = node.getPrevMcid();
                try {
                    // intentionally not using setters here (because of dirty flag)
                    node.mcid = null;
                    node.prevMcid = null;
                    if ("".equals(node.getTags())) {
                        node.setTags(null);
                    }
                    // for now let's just write text
                    // ipfsFiles.addFile(as, mfsPath, MediaType.APPLICATION_JSON_VALUE, XString.prettyPrint(node));
                    ipfsFiles.addFile(as, mfsPath, MediaType.TEXT_PLAIN_VALUE, node.getContent());
                } finally {
                    // retore values after done with json serializing (do NOT use setter methods here)
                    node.mcid = mcid;
                    node.prevMcid = prevMcid;
                }
                IPFSDirStat pathStat = ipfsFiles.pathStat(mfsPath);
                if (pathStat != null) {
                    log.debug("File PathStat: " + XString.prettyPrint(pathStat));
                    node.setPrevMcid(mcid);
                    node.setMcid(pathStat.getHash());
                }
                // pathStat = ipfsFiles.pathStat(pathBase);
                // if (ok(pathStat)) {
                // log.debug("Parent Folder PathStat " + pathBase + ": " + XString.prettyPrint(pathStat));
                // }
                // IPFSDir dir = ipfsFiles.getDir(pathBase);
                // if (ok(dir)) {
                // log.debug("Parent Folder Listing " + pathBase + ": " + XString.prettyPrint(dir));
                // }
                return null;
            });
        });
    }

    public void writeProfileToIPNS(SessionContext sc, String userName, String bio, String displayName) {
        if (!ThreadLocals.getSC().allowWeb3()) {
            return;
        }
        // Note: we need to access the current thread, because the rest of the logic runs in a damon thread.
        String userNodeId = ThreadLocals.getSC().getUserNodeId();
        exec.run(() -> {
            arun.run(as -> {
                SubNode userNode = read.getNode(as, userNodeId, false, null);
                String key = userNode.getStr(NodeProp.USER_IPFS_KEY);
                // If we didn't already generate the key for this user, then generate one.
                if (!sc.getUserNodeId().equals(key)) {
                    // make sure there is an IPFS key with same name as user's root ID.
                    Map<String, Object> keyGenResult = ipfsKey.gen(as, sc.getUserNodeId());
                    if (keyGenResult == null) {
                        log.debug("Unable to generate IPFS Key for Name " + sc.getUserNodeId());
                    } else {
                        userNode.set(NodeProp.USER_IPFS_KEY, sc.getUserNodeId());
                        log.debug("Key Gen Result: " + XString.prettyPrint(keyGenResult));
                    }
                }
                APODID did = new APODID(userName + "@" + prop.getMetaHost());
                did.put("bio", bio);
                did.put("displayName", displayName);
                String didPayload = XString.prettyPrint(did);
                String cid = null;
                log.debug("Writing UserProfile of " + userName + " to IPNS: " + didPayload);
                // make a folder for this user
                String folderName = "/" + userNodeId;
                // put identity file in this folder
                String fileName = folderName + "/identity.json";
                log.debug("identity file: " + fileName);
                // Instead let's wrap in a MFS folder type for now. This is all experimental so far.
                ipfsFiles.addFile(as, fileName, MediaType.APPLICATION_JSON_VALUE, didPayload);
                // Now we have to read the file we just wrote to get it's CID so we can publish it.
                IPFSDirStat pathStat = ipfsFiles.pathStat(folderName);
                if (pathStat == null) {
                    push.pushInfo(sc, new PushPageMessage("Decentralized Identity Publish FAILED", true, "note"));
                    return null;
                }
                log.debug("Parent Folder PathStat " + folderName + ": " + XString.prettyPrint(pathStat));
                // IPFSDir dir = ipfsFiles.getDir(folderName);
                cid = pathStat.getHash();
                log.debug("Publishing CID (root folder): " + cid);
                Map<String, Object> ret = ipfsName.publish(as, sc.getUserNodeId(), cid);
                log.debug("Publishing complete!");
                userNode.set(NodeProp.USER_DID_IPNS, ret.get("Name"));
                update.save(as, userNode);
                push.pushInfo(sc, new PushPageMessage("Decentralized Identity Publish Complete.", false, "note"));
                return null;
            });
        });
    }

    /*
     * Unpins any IPFS data that is not currently referenced by MongoDb. Cleans up orphans.
     */
    public String releaseOrphanIPFSPins(HashMap<ObjectId, UserStats> statsMap) {
        Val<String> ret = new Val<>("failed");
        // run as admin
        arun.run(as -> {
            int pinCount = 0;
            int orphanCount = 0;
            LinkedHashMap<String, Object> pins = toLinkedHashMap(ipfsPin.getPins());
            if (pins != null) {
                /*
                 * For each CID that is pinned we do a lookup to see if there's a Node that is using that PIN, and
                 * if not we remove the pin
                 */
                for (String pin : pins.keySet()) {
                    log.debug("Check PIN: " + pin);
                    boolean attachment = false;
                    SubNode ipfsNode = read.findByIPFSPinned(as, pin);
                    Attachment att = ipfsNode.getFirstAttachment();

                    // if there was no IPFS_LINK using this pin, then check to see if any node has the SubNode.CID
                    if (ipfsNode != null) {
                        /*
                         * ipfsNode = read.findByCID(as, pin); // 'backing' the MFS file storage don't even appear in
                         * the pinning system. // are // to pin it ever, so for now I'm leaving this code here, but we
                         * don't need it, and the CIDs that // turns out MFS stuff will never be Garbage Collected, no
                         * matter what, so we don't need
                         */
                        attachment = true;
                        pinCount++;
                        log.debug("Found CID" + (attachment ? "(att)" : "") + " nodeId=" + ipfsNode.getIdStr());
                        if (attachment && statsMap != null) {
                            Long binSize = att != null ? att.getSize() : null;
                            if (binSize == null) {
                                // Note: If binTotal is ever zero here we SHOULD do what's in the comment above
                                // an call objectStat to put correct amount in.
                                binSize = 0L;
                            }
                            /*
                             * Make sure storage space for this IPFS node pin is built into user quota. NOTE: We could
                             * be more aggressive about 'correctness' here and actually call ipfs.objectStat on each
                             * CID, to get a more bullet proof total bytes amount, but we are safe enough trusting what
                             * the node info holds, because it should be correct.
                             */
                            UserStats stats = statsMap.get(ipfsNode.getOwner());
                            if (stats == null) {
                                stats = new UserStats();
                                stats.binUsage = binSize;
                                statsMap.put(ipfsNode.getOwner(), stats);
                            } else {
                                stats.binUsage = stats.binUsage.longValue() + binSize;
                            }
                        }
                    } else {
                        orphanCount++;
                        ipfsPin.remove(pin);
                    }
                }
            }
            ret.setVal("Pins in use: " + pinCount + "\nOrphan Pins removed: " + orphanCount + "\n");
            log.debug(ret.getVal());
            return null;
        });
        return ret.getVal();
    }

}
