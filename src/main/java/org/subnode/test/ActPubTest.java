package org.subnode.test;

import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.subnode.service.ActPubService;

@Component("ActPubTest")
public class ActPubTest implements TestIntf {
    private static final Logger log = LoggerFactory.getLogger(ActPubTest.class);

    @Autowired
    private ActPubService actPubService;

    @Override
    public void test() throws Exception {
        try {
            // log.debug("Running ActPubTest.");

            // String urlStr = "http://localhost:3000/.well-known/webfinger";
            // URL url = new URL(urlStr);
            // HttpURLConnection con = (HttpURLConnection) url.openConnection();
            // con.setRequestMethod("GET");

            // Map<String, String> parameters = new HashMap<>();
            // parameters.put("resource", "acct:alice@localhost:3000");

            // con.setDoOutput(true);
            // DataOutputStream out = new DataOutputStream(con.getOutputStream());
            // out.writeBytes(ParameterStringBuilder.getParamsString(parameters));
            // out.flush();
            // out.close();

            // String inReplyTo =
            // "https://social.teci.world/objects/c159dd9b-9394-4536-bb82-b801aa2ff8db";
            // String toInbox = "https://social.teci.world/users/WClayFerguson/inbox";
            // String toActor = "https://social.teci.world/users/WClayFerguson";
            // actPubService.sendNote(toInbox, "WClayFerguson", inReplyTo, "Hello world
            // (Second Try).", toActor);

            // //
            // https://fosstodon.org/.well-known/webfinger?resource=acct:WClayFerguson@fosstodon.org'
            // APObj webFinger = actPubService.getWebFinger("https://fosstodon.org",
            // "WClayFerguson@fosstodon.org");
            // //"tychi@fosstodon.org");
            // Map<String,Object> self = actPubService.getLinkByRel(webFinger, "self");
            // log.debug("Self Link: "+XString.prettyPrint(self));
            // if (self != null) {
            // APObj actor = actPubService.getActor((String)self.get("href"));
            // APObj outbox = actPubService.getOutbox(actor.getStr("outbox"));
            // APObj ocPage =
            // actPubService.getOrderedCollectionPage(outbox.getStr("first"));

            // // // get 3 pages of the outbox
            // // int page = 1;
            // // while (ocPage != null && ++page <= 3) {
            // // log.debug("$$$$$$$$$$$$$$$$$$ PAGE " + page);
            // // ocPage = actPubService.getOrderedCollectionPage(outbox.getStr("next"));
            // // }
            // }
        } finally {
        }
    }

    public static String getParamsString(Map<String, String> params) throws UnsupportedEncodingException {
        StringBuilder result = new StringBuilder();

        for (Map.Entry<String, String> entry : params.entrySet()) {
            result.append(URLEncoder.encode(entry.getKey(), "UTF-8"));
            result.append("=");
            result.append(URLEncoder.encode(entry.getValue(), "UTF-8"));
            result.append("&");
        }

        String resultString = result.toString();
        return resultString.length() > 0 ? resultString.substring(0, resultString.length() - 1) : resultString;
    }
}
