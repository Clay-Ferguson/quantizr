package quanta.test;

import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;
import quanta.model.ipfs.dag.MerkleLink;
import quanta.model.ipfs.dag.MerkleNode;
import quanta.util.Val;
import quanta.util.XString;

@Component("IPFSTest")
public class IPFSTest extends ServiceBase implements TestIntf {
    private static final Logger log = LoggerFactory.getLogger(IPFSTest.class);

    @Override
    public void test() throws Exception {
        log.debug("IPFSTest.test() running.");
        // testUploadDirectory();
        // ipfs.getRepoStat();
        ipnsTest();
    }


    private void testUploadDirectory() {
        arun.run(as -> {
            // create the root directory
            MerkleNode rootDir = ipfs.newObject();
            log.debug("rootDir: " + XString.prettyPrint(rootDir));

            // create a file to put in the directory.
            MerkleLink file1 = ipfs.addFileFromString(as, "Test file one (new)", "fileone.txt", "text/plain", false);
            log.debug("file1: " + XString.prettyPrint(file1));

            MerkleLink file2 = ipfs.addFileFromString(as, "Test file two", "filetwo.txt", "text/plain", false);
            log.debug("file2: " + XString.prettyPrint(file2));

            MerkleNode newRootDir = ipfs.addFileToDagRoot(rootDir.getHash(), "subfolder/fileone.txt", file1.getHash());
            log.debug("newRoot (first file added): " + XString.prettyPrint(newRootDir));
            return null;
        });
    }

    public void ipnsTest() throws Exception {
        // ipfs.getPins();
        arun.run(as -> {
            log.debug("Running IPNS Test.");

            // Save some JSON to a CID
            Val<String> cid = new Val<>();
            ipfs.dagPutFromString(as, "{\"data\": \"MY FIRST DAG PUT\"}", null, null, cid);
            log.debug("Cid=" + cid.getVal());

            String verify = ipfs.dagGet(cid.getVal());
            log.debug("verify: " + verify);

            Map<String, Object> ret = ipfs.ipnsPublish(as, "ClaysKey", cid.getVal());
            log.debug("ipnsPublishRet: " + XString.prettyPrint(ret));

            String ipnsName = (String) ret.get("Name");
            ret = ipfs.ipnsResolve(as, ipnsName);
            log.debug("ipnsResolveRet: " + XString.prettyPrint(ret));

            // verify = ipfs.dagGet(ipnsName);
            // log.debug("verifyIPNS!: " + verify);

            // --------------

            ipfs.dagPutFromString(as, "{\"data\": \"MY SECOND DAG PUT\"}", null, null, cid);
            log.debug("Cid (Second Version)=" + cid.getVal());

            verify = ipfs.dagGet(cid.getVal());
            log.debug("verify (second): " + verify);

            ret = ipfs.ipnsPublish(as, "ClaysKey", cid.getVal());
            log.debug("ipnsPublishRet (second): " + XString.prettyPrint(ret));

            ipnsName = (String) ret.get("Name");
            ret = ipfs.ipnsResolve(as, ipnsName);
            log.debug("ipnsResolveRet (second): " + XString.prettyPrint(ret));
            return null;
        });
    }

    public void oldTest() throws Exception {
        try {
            String hash = "QmaaqrHyAQm7gALkRW8DcfGX3u8q9rWKnxEMmf7m9z515w";
            log.debug("Querying Hash: " + hash);
            String json = ipfs.getAsString(hash, "json");
            log.debug("JSON [" + hash + "]=" + json);

            log.debug("Querying for MerkleNode...");
            MerkleNode mnode = ipfs.getMerkleNode(hash, "json");
            log.debug("MerkleNode: " + XString.prettyPrint(mnode));

            // String merkContent = ipfs.objectCat(hash);
        } finally {
        }
    }
}
