package org.subnode.test;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.subnode.model.MerkleNode;
import org.subnode.mongo.RunAsMongoAdmin;
import org.subnode.service.IPFSService;
import org.subnode.util.ValContainer;
import org.subnode.util.XString;

@Component("IPFSTest")
public class IPFSTest implements TestIntf {
    private static final Logger log = LoggerFactory.getLogger(IPFSTest.class);

    @Autowired
    private IPFSService ipfs;

    @Autowired
    private RunAsMongoAdmin adminRunner;

    @Override
    public void test() throws Exception {
        log.debug("IPFSTest.test() running.");
        // ipfs.getPins();
        adminRunner.run(mongoSession -> {
            ValContainer<String> cid = new ValContainer<String>();
            ipfs.dagPutFromString(mongoSession, "{\"data\": \"MY FIRST DAG PUT\"}", null, null, cid);
            log.debug("Cid=" + cid.getVal());

            String verify = ipfs.dagGet(cid.getVal());
            log.debug("verify: " + verify);

            Map<String, Object> ret = ipfs.ipnsPublish(mongoSession, "ClaysKey", cid.getVal());
            log.debug("ipnsPublishRet: " + XString.prettyPrint(ret));

            String ipnsName = (String)ret.get("Name");
            ret = ipfs.ipnsResolve(mongoSession, ipnsName);
            log.debug("ipnsResolveRet: " + XString.prettyPrint(ret));

            // verify = ipfs.dagGet(ipnsName);
            // log.debug("verifyIPNS!: " + verify);

            // --------------

            ipfs.dagPutFromString(mongoSession, "{\"data\": \"MY SECOND DAG PUT\"}", null, null, cid);
            log.debug("Cid (Second Version)=" + cid.getVal());

            verify = ipfs.dagGet(cid.getVal());
            log.debug("verify (second): " + verify);

            ret = ipfs.ipnsPublish(mongoSession, "ClaysKey", cid.getVal());
            log.debug("ipnsPublishRet (second): " + XString.prettyPrint(ret));

            ipnsName = (String)ret.get("Name");
            ret = ipfs.ipnsResolve(mongoSession, ipnsName);
            log.debug("ipnsResolveRet (second): " + XString.prettyPrint(ret));
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
