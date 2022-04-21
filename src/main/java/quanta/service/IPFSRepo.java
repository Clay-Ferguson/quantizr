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
public class IPFSRepo extends ServiceBase {
    private static final Logger log = LoggerFactory.getLogger(IPFSRepo.class);

    public static String API_REPO;

    @PostConstruct
    public void init() {
        API_REPO = prop.getIPFSApiBase() + "/repo";
    }

    public String getStat() {
        StringBuilder sb = new StringBuilder();
        LinkedHashMap<String, Object> res = null;

        res = Cast.toLinkedHashMap(ipfs.postForJsonReply(API_REPO + "/stat?human=true", LinkedHashMap.class));
        sb.append("\nIPFS Repository Status:\n" + XString.prettyPrint(res) + "\n");

        res = Cast.toLinkedHashMap(ipfs.postForJsonReply(ipfs.API_CONFIG + "/show", LinkedHashMap.class));
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

    /*
     * this appears to be broken due to a bug in IPFS? Haven't reported an error to them yet. Returns
     * HTTP success (200), but no data. It should be returnin JSON but doesn't, so I have hacked the
     * postForJsonReply to always return 'success' in this scenario (200 with no body)
     */
    public String verify() {
        String url = API_REPO + "/verify";
        LinkedHashMap<String, Object> res = Cast.toLinkedHashMap(ipfs.postForJsonReply(url, LinkedHashMap.class));
        return "\nIPFS Repository Verify:\n" + XString.prettyPrint(res) + "\n";
    }

    public String gc() {
        String url = API_REPO + "/gc";
        // LinkedHashMap<String, Object> res = Cast.toLinkedHashMap(postForJsonReply(url,
        // LinkedHashMap.class));
        // return "\nIPFS Repository Garbage Collect:\n" + XString.prettyPrint(res) + "\n";
        String res = (String) ipfs.postForJsonReply(url, String.class);
        return "\nIPFS Repository Garbage Collect:\n" + res + "\n";
    }
}
