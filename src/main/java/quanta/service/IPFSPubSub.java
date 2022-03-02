package quanta.service;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Base64;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.ContextRefreshedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import quanta.AppServer;
import quanta.config.ServiceBase;
import quanta.config.SessionContext;
import quanta.model.client.IPSMData;
import quanta.model.client.IPSMMessage;
import quanta.mongo.MongoRepository;
import quanta.response.IPSMPushInfo;
import quanta.response.ServerPushInfo;
import quanta.util.Cast;
import quanta.util.DateUtil;
import quanta.util.Util;
import quanta.util.XString;

// IPFS Reference: https://docs.ipfs.io/reference/http/api

@Component
public class IPFSPubSub extends ServiceBase {
    private static final Logger log = LoggerFactory.getLogger(IPFSPubSub.class);

    private static final boolean IPSM_ENABLE = false;
    private static final String IPSM_TOPIC_HEARTBEAT = "ipsm-heartbeat";
    private static final String IPSM_TOPIC_TEST = "/ipsm/test";

    private static final RestTemplate restTemplate = new RestTemplate(Util.getClientHttpRequestFactory(10000));
    private static final ObjectMapper mapper = new ObjectMapper();

    // private static int heartbeatCounter = 0;

    private static final HashMap<String, Integer> fromCounter = new HashMap<>();

    @EventListener
	public void handleContextRefresh(ContextRefreshedEvent event) {
        ServiceBase.init(event.getApplicationContext());
        log.debug("ContextRefreshedEvent");
        // log.debug("Checking swarmPeers");
        // swarmPeers();

        if (IPSM_ENABLE) {
            exec.run(null, () -> {
                setOptions();
                ipfs.doSwarmConnect();
                Util.sleep(3000);
                openChannel(IPSM_TOPIC_HEARTBEAT);
                openChannel(IPSM_TOPIC_TEST);
            });
        }
    }

    public void setOptions() {
        // Only used this for some testing (shouldn't be required?)
        // if these are the defaults ?
        LinkedHashMap<String, Object> res = null;

        // Pubsub.Router="floodsub" | "gossipsub"
        // todo-2: we can add this to the startup bash scripts along with the CORS configs?
        res = Cast.toLinkedHashMap(
                ipfs.postForJsonReply(IPFSService.API_CONFIG + "?arg=Pubsub.Router&arg=gossipsub", LinkedHashMap.class));
        log.debug("\nIPFS Pubsub.Router set:\n" + XString.prettyPrint(res) + "\n");

        res = Cast.toLinkedHashMap(ipfs.postForJsonReply(
                IPFSService.API_CONFIG + "?arg=Pubsub.DisableSigning&arg=false&bool=true", LinkedHashMap.class));
        log.debug("\nIPFS Pubsub.DisableSigning set:\n" + XString.prettyPrint(res) + "\n");
    }

    // DO NOT DELETE (IPSM)
    // send out a heartbeat from this server every few seconds for testing purposes
    // @Scheduled(fixedDelay = 10 * DateUtil.SECOND_MILLIS)
    // public void ipsmHeartbeat() {
    // if (IPSM_ENABLE) {
    // // ensure instanceId loaded
    // ipfs.getInstanceId();
    // pub(IPSM_TOPIC_HEARTBEAT, (String) ipfs.instanceId.get("ID") + "-ipsm-" +
    // String.valueOf(heartbeatCounter++) + "\n");
    // }}

    public void openChannel(String topic) {
        if (IPSM_ENABLE) {
            exec.run(null, () -> {
                log.debug("openChannel: " + topic);
                // we do some reads every few seconds so we should pick up several heartbeats
                // if there are any being sent from other servers
                while (!AppServer.isShuttingDown()) {
                    sub(topic);
                    Util.sleep(1000);
                }
                log.debug("channel sub thread terminating: " + topic);
            });
        }
    }

    // PubSub publish
    public Map<String, Object> pub(String topic, String message) {
        Map<String, Object> ret = null;
        try {
            String url = IPFSService.API_PUBSUB + "/pub?arg=" + topic + "&arg=" + message;

            HttpHeaders headers = new HttpHeaders();
            MultiValueMap<String, Object> bodyMap = new LinkedMultiValueMap<>();
            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(bodyMap, headers);

            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, requestEntity, String.class);
            // ret = mapper.readValue(response.getBody(), new TypeReference<Map<String, Object>>() {});
            log.debug("IPFS pub to [resp code=" + response.getStatusCode() + "] " + topic);
        } catch (Exception e) {
            log.error("Failed in restTemplate.exchange", e);
        }
        return ret;
    }

    public void sub(String topic) {
        String url = IPFSService.API_PUBSUB + "/sub?arg=" + topic;
        try {
            HttpURLConnection conn = configureConnection(new URL(url), "POST");
            InputStream is = conn.getInputStream();
            getObjectStream(is);
        } catch (Exception e) {
            log.error("Failed to read: " + topic); // , e);
        }
    }

    HttpURLConnection configureConnection(URL target, String method) throws IOException {
        HttpURLConnection conn = (HttpURLConnection) target.openConnection();
        conn.setRequestMethod(method);
        // conn.setRequestProperty("Content-Type", "application/json");
        conn.setConnectTimeout(30000);
        conn.setReadTimeout(30000);
        return conn;
    }

    private void getObjectStream(InputStream in) throws IOException {
        byte LINE_FEED = (byte) 10;
        ByteArrayOutputStream resp = new ByteArrayOutputStream();
        byte[] buf = new byte[4096];
        int r;

        while ((r = in.read(buf)) >= 0) {
            resp.write(buf, 0, r);
            if (buf[r - 1] == LINE_FEED) {
                log.debug("LINE: " + new String(resp.toByteArray()));
                Map<String, Object> event = mapper.readValue(resp.toByteArray(), new TypeReference<Map<String, Object>>() {});
                processInboundEvent(event);
                resp = new ByteArrayOutputStream();
            }
        }
    }

    // clear throttle counters every minute.
    @Scheduled(fixedDelay = DateUtil.MINUTE_MILLIS)
    public void clearThrottles() {
        if (!MongoRepository.fullInit)
            return;
        synchronized (fromCounter) {
            fromCounter.clear();
        }
    }

    public void processInboundEvent(Map<String, Object> msg) {
        String from = (String) msg.get("from");
        if (no(from))
            return;
        if (throttle(from))
            return;

        String data = (String) msg.get("data");
        // String seqno = (String) msg.get("seqno");
        String payload = (new String(Base64.getDecoder().decode(data)));
        log.debug("PAYLOAD: " + payload);
        processInboundPayload(payload);
    }

    /* Returns true if we're throttling the 'from' */
    boolean throttle(String from) {
        synchronized (fromCounter) {
            Integer hitCount = fromCounter.get(from);

            if (no(hitCount)) {
                fromCounter.put(from, 1);
                return false;
            } else {
                if (hitCount.intValue() > 10) {
                    return true;
                }
                hitCount = hitCount.intValue() + 1;
                fromCounter.put(from, hitCount);
                return false;
            }
        }
    }

    private void processInboundPayload(String payload) {
        if (no(payload))
            return;

        ServerPushInfo pushInfo = null;
        payload = payload.trim();
        if (payload.startsWith("{") && payload.endsWith("}")) {
            IPSMMessage msg = parseIpsmPayload(payload);
            if (no(msg))
                return;

            String message = getMessageText(msg);
            pushInfo = new IPSMPushInfo(message);
        } else {
            pushInfo = new IPSMPushInfo(payload);
        }

        for (SessionContext sc : SessionContext.getAllSessions(true)) {

            // only consider sessions that have viewed their IPSM tab
            if (!sc.isEnableIPSM() || sc.isAnonUser() || !sc.isLive()) {
                continue;
            }

            // log.debug("Pushing to session: sc.user: " + sc.getUserName() + " " + payload);
            push.sendServerPushInfo(sc, pushInfo);
        }
    }

    private String getMessageText(IPSMMessage msg) {
        if (no(msg) || no(msg.getContent()))
            return null;
        StringBuilder sb = new StringBuilder();
        for (IPSMData data : msg.getContent()) {
            String text = ipfs.catToString(data.getData());
            sb.append(text);
        }
        return sb.toString();
    }

    private IPSMMessage parseIpsmPayload(String payload) {
        try {
            IPSMMessage msg = mapper.readValue(payload, IPSMMessage.class);
            if (verifySignature(msg)) {
                log.debug("Signature Failed.");
                return null;
            }
            if (ok(msg)) {
                log.debug("JSON: " + XString.prettyPrint(msg));
            }
            return msg;
        } catch (Exception e) {
            log.error("JSON Parse failed: " + payload);
            return null;
        }
    }

    // https://www.npmjs.com/package/node-rsa
    // Default signature scheme: 'pkcs1-sha256'
    public boolean verifySignature(IPSMMessage msg) {
        String strDat = String.valueOf(msg.getTs()) + XString.compactPrint(msg.getContent());
        // log.debug("strDat=" + strDat);
        return true;
    }
}
