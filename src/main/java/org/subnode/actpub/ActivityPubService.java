package org.subnode.actpub;

import org.subnode.actpub.model.ActPubCreate;
import org.subnode.actpub.model.ActPubObject;
import org.subnode.config.ConstantsProvider;
import org.subnode.response.base.ResponseBase;

import org.joda.time.DateTime;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Component
public class ActivityPubService {
    private static final Logger log = LoggerFactory.getLogger(ActivityPubService.class);

    @Autowired
    private RestTemplate restTemplate;

    @Autowired
    private ConstantsProvider constProvider;

    @Autowired
    private CryptoUtil cryptoUtil;

    public void sendMessage(String message, String inboxPath) {
        log.debug("Sending ActivityPub message: " + message);

        String actorId = constProvider.getHostAndPort() + ActivityPubController.API_PATH + "/actor";
        String createId = constProvider.getHostAndPort() + ActivityPubController.API_PATH + "/act-pub-create/fake0000";
        String objectId = constProvider.getHostAndPort() + ActivityPubController.API_PATH + "/act-pub-obj/fake0000";

        RestTemplate restTemplate = new RestTemplate();

        ActPubCreate apc = new ActPubCreate();
        apc.setId(createId);
        apc.setContext("https://www.w3.org/ns/activitystreams");
        apc.setType("Create");
        apc.setActor(actorId);

        ActPubObject apo = new ActPubObject();
        apo.setId(objectId);
        apo.setAttributedTo(actorId);
        apo.setPublished(new DateTime().toString());

        String replyTo = "https://mastodon.social/@wclayf/100968521270205694";
        if (message.contains("gargron")) {
            replyTo = "https://mastodon.social/@Gargron/100254678717223630";
        }

        apo.setInReplyTo(replyTo); 
        apo.setContent(message);
        apo.setType("Note");
        apo.setTo("https://www.w3.org/ns/activitystreams#Public");
        apc.setObject(apo);

        //I can't find any mastodon info on what the true format of an inbox url is for a specific user or if
        //ONLY the global /inbox is all that exists.

        String toInbox = "https://mastodon.social" + inboxPath;

        log.debug("posting toInbox: " + toInbox);

        String now = new DateTime().toString();
        String stringToSign = "(request-target): post " + inboxPath + "\nhost: mastodon.social\ndate: " + now;
        String signedString = cryptoUtil.sign(stringToSign);
        String signature = "keyId=\"" + actorId + "\",headers=\"(request-target) host date\",signature=\""
                + signedString + "\"";

        HttpHeaders headers = new HttpHeaders();

        headers.set("host", "mastodon.social");
        headers.set("date", now);
        headers.set("signature", signature);

        HttpEntity<ActPubCreate> request = new HttpEntity<>(apc, headers);

        // getting this: POST request for "https://mastodon.social/inbox" resulted in
        // 401 (Unauthorized); invoking error handler
        try {
            ResponseEntity<ResponseBase> response = restTemplate.exchange(toInbox, HttpMethod.POST, request,
                    ResponseBase.class);
            ResponseBase respBody = response.getBody();
            log.debug("Response Body: "+response.getBody().toString());
            log.debug("Response Object: "+response.toString());
            log.debug(
                    "HTTP call status: " + response.getStatusCode().toString() + " response: " + respBody.getMessage());
        } catch (Exception e) {
            log.error("Failed in restTemplate.exchange", e);
        }
    }
}