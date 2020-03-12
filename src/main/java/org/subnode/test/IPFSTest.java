package org.subnode.test;

import org.subnode.model.MerkleNode;
import org.subnode.service.IPFSService;
import org.subnode.util.XString;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component("IPFSTest")
public class IPFSTest implements TestIntf {
    private static final Logger log = LoggerFactory.getLogger(IPFSTest.class);

    @Autowired
    private IPFSService ipfs;

    @Override
    public void test() throws Exception {
        try {
            String hash = "QmaaqrHyAQm7gALkRW8DcfGX3u8q9rWKnxEMmf7m9z515w";
            log.debug("Querying Hash: " + hash);
            String json = ipfs.getAsString(hash, "json");
            log.debug("JSON [" + hash + "]=" + json);

            log.debug("Querying for MerkleNode...");
            MerkleNode mnode = ipfs.getMerkleNode(hash, "json");
            log.debug("MerkleNode: "+XString.prettyPrint(mnode));

            //String merkContent = ipfs.objectCat(hash);
        } finally {

        }
    }
}
