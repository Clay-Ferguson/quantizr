package quanta.service;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.util.HashMap;
import java.util.LinkedHashMap;
import javax.annotation.PostConstruct;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;
import quanta.model.client.NodeProp;
import quanta.model.ipfs.file.IPFSObjectStat;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.util.Cast;
import quanta.util.Util;
import quanta.util.XString;

@Component
public class IPFSPin extends ServiceBase {
    private static final Logger log = LoggerFactory.getLogger(IPFSPin.class);

    public static String API_PIN;

    @PostConstruct
    public void init() {
        API_PIN = prop.getIPFSApiBase() + "/pin";
    }

    public String verify() {
        if (!prop.ipfsEnabled()) return "IPFS not enabled.";
        String url = API_PIN + "/verify";
        // LinkedHashMap<String, Object> res =
        // Cast.toLinkedHashMap(postForJsonReply(url, LinkedHashMap.class));
        // casting to a string now, because a bug in IPFS is making it not return data,
        // so we get back string "success"
        String res = (String) ipfs.postForJsonReply(url, String.class);
        return "\nIPFS Pin Verify:\n" + XString.prettyPrint(res) + "\n";
    }

    public boolean remove(String cid) {
        checkIpfs();
        // log.debug("Remove Pin: " + cid);
        String url = API_PIN + "/rm?arg=" + cid;
        return ok(ipfs.postForJsonReply(url, Object.class));
    }

    public boolean add(String cid) {
        checkIpfs();
        // log.debug("Add Pin: " + cid);
        String url = API_PIN + "/add?arg=" + cid;
        return ok(ipfs.postForJsonReply(url, Object.class));
    }

    public LinkedHashMap<String, Object> getPins() {
        if (!prop.ipfsEnabled()) return null;
        LinkedHashMap<String, Object> pins = null;
        HashMap<String, Object> res = null;
        try {
            String url = API_PIN + "/ls?type=recursive";
            res = Cast.toLinkedHashMap(ipfs.postForJsonReply(url, LinkedHashMap.class));
            // log.debug("RAW PINS LIST RESULT: " + XString.prettyPrint(res));

            if (ok(res)) {
                pins = Cast.toLinkedHashMap(res.get("Keys"));
            }
        } catch (Exception e) {
            log.error("Failed to get pins", e);
        }
        return pins;
    }

    public void ipfsAsyncPinNode(MongoSession ms, ObjectId nodeId) {
        if (!prop.ipfsEnabled()) return;
        exec.run(() -> {
            // wait for node to be saved. Waits up to 30 seconds, because of the 10 retries.
            /*
             * todo-2: What we could do here instead of of this polling is hook into the MongoEventListener
             * class and have a pub/sub model in effect so we can detect immediately when the node is saved.
             */
            Util.sleep(3000);
            SubNode node = read.getNode(ms, nodeId, false, 10);

            if (no(node))
                return;
            String ipfsLink = node.getStr(NodeProp.IPFS_LINK);
            add(ipfsLink);

            // always get bytes here from IPFS, and update the node prop with that too.
            IPFSObjectStat stat = ipfsObj.objectStat(ipfsLink, false);

            // note: the enclosing scope this we're running in will take care of comitting the node change to
            // the db.
            node.set(NodeProp.BIN_SIZE, stat.getCumulativeSize());

            /* And finally update this user's quota for the added storage */
            SubNode accountNode = read.getUserNodeByUserName(ms, null);
            if (ok(accountNode)) {
                user.addBytesToUserNodeBytes(ms, stat.getCumulativeSize(), accountNode, 1);
            }
        });
    }
}
