package quanta.service;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import javax.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;
import quanta.model.ipfs.dag.MerkleLink;
import quanta.model.ipfs.file.IPFSDir;
import quanta.model.ipfs.file.IPFSDirEntry;
import quanta.model.ipfs.file.IPFSDirStat;
import quanta.mongo.MongoSession;
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

    public MerkleLink addFile(MongoSession ms, String fileName, String content) {
		return addFile(ms, fileName, content.getBytes(StandardCharsets.UTF_8));
	}

    public MerkleLink addFile(MongoSession ms, String fileName, byte[] bytes) {
		return addEntry(ms, fileName, new ByteArrayInputStream(bytes));
	}

	public MerkleLink addEntry(MongoSession ms, String fileName, InputStream stream) {
		return ipfsFiles.addFileFromStream(ms, fileName, stream, null, null);
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
}
