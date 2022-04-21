package quanta.service;

import java.util.LinkedHashMap;
import javax.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;
import quanta.util.Cast;
import quanta.util.XString;

@Component
public class IPFSConfig extends ServiceBase {
    private static final Logger log = LoggerFactory.getLogger(IPFSConfig.class);

    public String API_CONFIG;

    @PostConstruct
    public void init() {
        API_CONFIG = prop.getIPFSApiBase() + "/config";
    }

    public String getStat() {
        StringBuilder sb = new StringBuilder();
        LinkedHashMap<String, Object> res = null;

        res = Cast.toLinkedHashMap(ipfs.postForJsonReply(ipfsRepo.API_REPO + "/stat?human=true", LinkedHashMap.class));
        sb.append("\nIPFS Repository Status:\n" + XString.prettyPrint(res) + "\n");

        res = Cast.toLinkedHashMap(ipfs.postForJsonReply(API_CONFIG + "/show", LinkedHashMap.class));
        sb.append("\nIPFS Config:\n" + XString.prettyPrint(res) + "\n");

        res = Cast.toLinkedHashMap(ipfs.postForJsonReply(ipfs.API_ID, LinkedHashMap.class));
        sb.append("\nIPFS Instance ID:\n" + XString.prettyPrint(res) + "\n");

        // res = Cast.toLinkedHashMap(postForJsonReply(API_PUBSUB + "/peers?arg=" + topic,
        // LinkedHashMap.class));
        // sb.append("\nIPFS Peers for topic:\n" + XString.prettyPrint(res) + "\n");

        // res = Cast.toLinkedHashMap(postForJsonReply(API_PUBSUB + "/ls", LinkedHashMap.class));
        // sb.append("\nIPFS Topics List:\n" + XString.prettyPrint(res) + "\n");

        return sb.toString();
    }
}
