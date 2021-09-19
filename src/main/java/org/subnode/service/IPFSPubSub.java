package org.subnode.service;


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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.subnode.AppServer;
import org.subnode.config.SessionContext;
import org.subnode.response.IPSMPushInfo;
import org.subnode.util.AsyncExec;
import org.subnode.util.Cast;
import org.subnode.util.DateUtil;
import org.subnode.util.Util;
import org.subnode.util.XString;

// IPFS Reference: https://docs.ipfs.io/reference/http/api

@Component
public class IPFSPubSub {
    private static final Logger log = LoggerFactory.getLogger(IPFSPubSub.class);

    @Autowired
    private AsyncExec asyncExec;

    @Autowired
    private PushService push;

    @Autowired
    private IPFSService ipfs;

    private static final RestTemplate restTemplate = new RestTemplate(Util.getClientHttpRequestFactory());
    private static final ObjectMapper mapper = new ObjectMapper();

    private static int heartbeatCounter = 0;

    private static final HashMap<String, Integer> fromCounter = new HashMap<>();

    public void setOptions() {
        // Only used this for some testing (shouldn't be required?)
        // if these are the defaults ?
        LinkedHashMap<String, Object> res = null;

        // Pubsub.Router="floodsub" | "gossipsub"
        res = Cast.toLinkedHashMap(
                ipfs.postForJsonReply(IPFSService.API_CONFIG + "?arg=Pubsub.Router&arg=gossipsub", LinkedHashMap.class));
        log.debug("\nIPFS Pubsub.Router set:\n" + XString.prettyPrint(res) + "\n");

        res = Cast.toLinkedHashMap(ipfs.postForJsonReply(
                IPFSService.API_CONFIG + "?arg=Pubsub.DisableSigning&arg=false&bool=true", LinkedHashMap.class));
        log.debug("\nIPFS Pubsub.DisableSigning set:\n" + XString.prettyPrint(res) + "\n");
    }

    // send out a heartbeat from this server every few seconds for testing purposes
    @Scheduled(fixedDelay = 10 * DateUtil.SECOND_MILLIS)
    public void ipsmHeartbeat() {
        // ensure instanceId loaded
        ipfs.getInstanceId();
        pub("ipsm-heartbeat", (String) ipfs.instanceId.get("ID") + "-ipsm-" + String.valueOf(heartbeatCounter++) + "\n");
    }

    public void init() {
        // log.debug("Checking swarmPeers");
        // swarmPeers();

        log.debug("pubSubInit");
        asyncExec.run(null, () -> {
            setOptions();

            // todo-0: this can throw errors when self-dialing, or whatever. not stopping things from working
            // afaik.
            // but I need to look into swarm peers more.
            ipfs.doSwarmConnect();
            Util.sleep(3000);

            log.debug("Subscribing");

            // we do some reads every few seconds so we should pick up several heartbeats
            // if there are any being sent from other servers
            while (!AppServer.isShuttingDown()) {
                sub("ipsm-heartbeat");
                Util.sleep(3000);
            }
            log.debug("Subscribe thread terminating");
        });
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
            log.error("Failed to read:", e);
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
        synchronized (fromCounter) {
            fromCounter.clear();
        }
    }

    public void processInboundEvent(Map<String, Object> msg) {
        String from = (String) msg.get("from");
        if (from == null)
            return;
        if (throttle(from))
            return;

        String data = (String) msg.get("data");
        String seqno = (String) msg.get("seqno");
        String payload = (new String(Base64.getDecoder().decode(data)));
        log.debug("MSG: " + payload + "\n" + //
                "    SEQ: " + seqno + "\n" + //
                "    FROM: " + from);
        processInboundPayload(payload);
    }

    /* Returns true if we're throttling the 'from' */
    boolean throttle(String from) {
        synchronized (fromCounter) {
            Integer hitCount = fromCounter.get(from);

            if (hitCount == null) {
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
        if (payload == null)
            return;

        for (SessionContext sc : SessionContext.getAllSessions()) {
            log.debug("Pushing to session: sc.user: " + sc.getUserName() + " " + payload);

            // todo-0: need a way to ONLY send to clients who have at least once visited their IPSM tab.
            // or even queue these up per browser to send only once every 5 seconds or so, max
            // for now we just bombard client.
            IPSMPushInfo pushInfo = new IPSMPushInfo(payload);
            push.sendServerPushInfo(sc, pushInfo);
        }
    }
}
