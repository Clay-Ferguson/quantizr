package quanta.service;

import java.io.InputStream;
import javax.annotation.PostConstruct;
import org.apache.commons.io.IOUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import quanta.config.AppProp;
import quanta.config.ServiceBase;
import quanta.model.ipfs.dag.DagNode;
import quanta.model.ipfs.dag.MerkleLink;
import quanta.mongo.MongoSession;
import quanta.util.Util;
import quanta.util.Val;

@Component
public class IPFSDag extends ServiceBase {
    private static final Logger log = LoggerFactory.getLogger(IPFSDag.class);

    @Autowired
    private AppProp prop;

    public static String API_BASE;
    public static String API_DAG;

    @PostConstruct
    public void init() {
        API_BASE = prop.getIPFSApiHostAndPort() + "/api/v0";
        API_DAG = API_BASE + "/dag";
    }

    public String getString(String hash) {
        String ret = null;
        try {
            String url = API_DAG + "/get?arg=" + hash; // + "&output-codec=dag-json";
            ResponseEntity<String> response =
                    ipfs.restTemplate.exchange(url, HttpMethod.POST, Util.getBasicRequestEntity(), String.class);
            ret = response.getBody();
            log.debug("IPFS post dagGet Ret " + response.getStatusCode() + "] " + ret);
        } catch (Exception e) {
            log.error("Failed to dagGet: " + hash, e);
        }
        return ret;
    }

    public DagNode getNode(String cid) {
        DagNode ret = null;
        try {
            String url = API_DAG + "/get?arg=" + cid;
            ret = (DagNode) ipfs.postForJsonReply(url, DagNode.class);
        } catch (Exception e) {
            log.error("Failed in getDagNode", e);
        }
        return ret;
    }

    public MerkleLink putString(MongoSession ms, String val, String mimeType, Val<Integer> streamSize, Val<String> cid) {
        return ipfs.writeFromStream(ms, API_DAG + "/put", IOUtils.toInputStream(val), null, streamSize, cid);
    }

    public MerkleLink putStream(MongoSession ms, InputStream stream, String mimeType, Val<Integer> streamSize,
            Val<String> cid) {
        return ipfs.writeFromStream(ms, API_DAG + "/put", stream, null, streamSize, cid);
    }
}
