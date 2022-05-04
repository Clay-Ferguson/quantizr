package quanta.service;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import javax.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;
import quanta.model.client.MFSDirEntry;
import quanta.model.ipfs.dag.MerkleLink;
import quanta.model.ipfs.file.IPFSDir;
import quanta.model.ipfs.file.IPFSDirEntry;
import quanta.model.ipfs.file.IPFSDirStat;
import quanta.mongo.MongoSession;
import quanta.request.DeleteMFSFileRequest;
import quanta.request.GetMFSFilesRequest;
import quanta.util.ThreadLocals;
import quanta.util.Val;
import quanta.util.XString;

@Component
public class IPFSFiles extends ServiceBase {
    private static final Logger log = LoggerFactory.getLogger(IPFSFiles.class);

    public static String API_FILES;

    @PostConstruct
    public void init() {
        API_FILES = prop.getIPFSApiBase() + "/files";
    }

    public IPFSDir getDir(String path) {
        String url = API_FILES + "/ls?arg=" + path + "&long=true";
        return (IPFSDir) ipfs.postForJsonReply(url, IPFSDir.class);
    }

    /* Deletes the file or if a folder deletes it recursively */
    public boolean deletePath(String path) {
        String url = API_FILES + "/rm?arg=" + path + "&force=true";
        return ok(ipfs.postForJsonReply(url, Object.class));
    }

    public boolean flushFiles(String path) {
        String url = API_FILES + "/flush?arg=" + path;
        return ok(ipfs.postForJsonReply(url, Object.class));
    }

    public void addFile(MongoSession ms, String fileName, String mimeType, String content) {
        addFile(ms, fileName, mimeType, content.getBytes(StandardCharsets.UTF_8));
    }

    public void addFile(MongoSession ms, String fileName, String mimeType, byte[] bytes) {
        addEntry(ms, fileName, mimeType, new ByteArrayInputStream(bytes));
    }

    public void addEntry(MongoSession ms, String fileName, String mimeType, InputStream stream) {
        ipfsFiles.addFileFromStream(ms, fileName, stream, mimeType, null);
    }

    public MerkleLink addFileFromStream(MongoSession ms, String fileName, InputStream stream, String mimeType,
            Val<Integer> streamSize) {
        // NOTE: the 'write' endpoint doesn't send back any data (no way to get the CID back)
        return ipfs.writeFromStream(ms, API_FILES + "/write?arg=" + fileName + "&create=true&parents=true&truncate=true", stream,
                null, streamSize);
    }

    public IPFSDirStat pathStat(String path) {
        String url = API_FILES + "/stat?arg=" + path;
        return (IPFSDirStat) ipfs.postForJsonReply(url, IPFSDirStat.class);
    }

    public String readFile(String path) {
        String url = API_FILES + "/read?arg=" + path;
        return (String) ipfs.postForJsonReply(url, String.class);
    }

    /* This has a side effect of deleting empty directories */
    public void traverseDir(String path, HashSet<String> allFilePaths, boolean deleteEmptyDirs) {
        log.debug("dumpDir: " + path);
        IPFSDir dir = getDir(path);
        if (ok(dir)) {
            log.debug("Dir: " + XString.prettyPrint(dir));

            if (deleteEmptyDirs && no(dir.getEntries())) {
                log.debug("DEL EMPTY FOLDER: " + path);
                deletePath(path);
                return;
            }

            for (IPFSDirEntry entry : dir.getEntries()) {
                String entryPath = path + "/" + entry.getName();

                // entries with 0 size are folders
                if (entry.getSize() == 0) {
                    traverseDir(entryPath, allFilePaths, deleteEmptyDirs);
                } else {
                    /*
                     * as a workaround to the IPFS bug, we rely on the logic of "if not a json file, it's a folder
                     */
                    if (!entry.getName().endsWith(".json")) {
                        traverseDir(entryPath, allFilePaths, deleteEmptyDirs);
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

    public void deleteMFSFile(MongoSession ms, DeleteMFSFileRequest req) {
        if (!ThreadLocals.getSC().getAllowedFeatures().contains("web3")) {
            return;
        }

        // Note: we need to access the current thread, because the rest of the logic runs in a damon thread.
        String userNodeId = ThreadLocals.getSC().getUserNodeId().toHexString();

        // make sure the user is deleting something ONLY in their own folder.
        if (!req.getItem().startsWith("/" + userNodeId)) {
            throw new RuntimeException("User does not own path: " + req.getItem());
        }

        deletePath(req.getItem());
    }

    public List<MFSDirEntry> getMFSFiles(MongoSession ms, Val<String> folder, Val<String> cid, GetMFSFilesRequest req) {
        LinkedList<MFSDirEntry> files = new LinkedList<>();

        if (!ThreadLocals.getSC().getAllowedFeatures().contains("web3")) {
            return null;
        }

        // Note: we need to access the current thread, because the rest of the logic runs in a damon thread.
        String userNodeId = ThreadLocals.getSC().getUserNodeId().toHexString();

        String mfsPath = no(req.getFolder()) ? ("/" + userNodeId) : req.getFolder();
        folder.setVal(mfsPath);
        // if this is a path...
        if (mfsPath.startsWith("/")) {

            IPFSDirStat pathStat = ipfsFiles.pathStat(mfsPath);
            if (ok(pathStat)) {
                cid.setVal(pathStat.getHash());
            }

            IPFSDir dir = getDir(mfsPath);
            if (ok(dir)) {
                log.debug("Dir: " + XString.prettyPrint(dir));
                if (ok(dir.getEntries())) {
                    for (IPFSDirEntry entry : dir.getEntries()) {
                        MFSDirEntry me = new MFSDirEntry();
                        me.setName(entry.getName());
                        me.setHash(entry.getHash());
                        me.setSize(entry.getSize());
                        me.setType(entry.getType());
                        files.add(me);
                    }
                }
            }
        }

        return files;
    }
}
