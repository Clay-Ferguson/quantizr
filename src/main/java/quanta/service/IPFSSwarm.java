package quanta.service;

import static quanta.util.Util.ok;
import java.util.List;
import java.util.Map;
import javax.annotation.PostConstruct;
import com.fasterxml.jackson.core.type.TypeReference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import quanta.config.AppProp;
import quanta.config.ServiceBase;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.util.XString;

@Component
public class IPFSSwarm extends ServiceBase {
    private static final Logger log = LoggerFactory.getLogger(IPFSSwarm.class);

    @Autowired
    private AppProp prop;

    public static String API_BASE;
    public static String API_SWARM;

    @PostConstruct
    public void init() {
        API_BASE = prop.getIPFSApiHostAndPort() + "/api/v0";
        API_SWARM = API_BASE + "/swarm";
    }

    public Map<String, Object> connect(String peer) {
        Map<String, Object> ret = null;
        try {
            log.debug("Swarm connect: " + peer);
            String url = API_SWARM + "/connect?arg=" + peer;

            HttpHeaders headers = new HttpHeaders();
            MultiValueMap<String, Object> bodyMap = new LinkedMultiValueMap<>();
            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(bodyMap, headers);

            ResponseEntity<String> response = ipfs.restTemplate.exchange(url, HttpMethod.POST, requestEntity, String.class);
            ret = ipfs.mapper.readValue(response.getBody(), new TypeReference<Map<String, Object>>() {});
            log.debug("IPFS swarm connect: " + XString.prettyPrint(ret));
        } catch (Exception e) {
            log.error("Failed in restTemplate.exchange", e);
        }
        return ret;
    }

    // PubSub List peers
    public Map<String, Object> listPeers() {
        Map<String, Object> ret = null;
        try {
            String url = API_SWARM + "/peers";

            HttpHeaders headers = new HttpHeaders();
            MultiValueMap<String, Object> bodyMap = new LinkedMultiValueMap<>();
            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(bodyMap, headers);

            ResponseEntity<String> response = ipfs.restTemplate.exchange(url, HttpMethod.POST, requestEntity, String.class);
            ret = ipfs.mapper.readValue(response.getBody(), new TypeReference<Map<String, Object>>() {});
            log.debug("IPFS swarm peers: " + XString.prettyPrint(ret));
        } catch (Exception e) {
            log.error("Failed in restTemplate.exchange", e);
        }
        return ret;
    }

    public void connect() {
        arun.run(ms -> {
            List<String> adrsList = getConnectAddresses(ms);
            if (ok(adrsList)) {
                for (String adrs : adrsList) {
                    if (adrs.startsWith("/")) {
                        connect(adrs);
                    }
                }
            }
            return null;
        });
    }

    public List<String> getConnectAddresses(MongoSession ms) {
        List<String> ret = null;
        SubNode node = read.getNode(ms, ":ipfsSwarmAddresses");
        if (ok(node)) {
            log.debug("swarmAddresses: " + node.getContent());
            ret = XString.tokenize(node.getContent(), "\n", true);
        }
        return ret;
    }
}
