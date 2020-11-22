package org.subnode.test;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.subnode.actpub.APObj;
import org.subnode.service.ActPubService;
import org.subnode.util.XString;

@Component("ActPubTest")
public class ActPubTest implements TestIntf {
    private static final Logger log = LoggerFactory.getLogger(ActPubTest.class);

    @Autowired
    private ActPubService actPubService;

    @Override
    public void test() throws Exception {
        try {
            log.debug("$$$$$$$$$$$$$$$$$$$$ Running ActPubTest.");
            // https://fosstodon.org/.well-known/webfinger?resource=acct:WClayFerguson@fosstodon.org'
            APObj webFinger = actPubService.getWebFinger("https://fosstodon.org",
                    "WClayFerguson@fosstodon.org");
                    //"tychi@fosstodon.org");
            Map<String,Object> self = actPubService.getLinkByRel(webFinger, "self");
            log.debug("Self Link: "+XString.prettyPrint(self));
            if (self != null) {
                APObj actor = actPubService.getActor((String)self.get("href"));
                APObj outbox = actPubService.getOutbox(actor.getStr("outbox"));
                APObj ocPage = actPubService.getOrderedCollectionPage(outbox.getStr("first"));

                // // get 3 pages of the outbox
                // int page = 1;
                // while (ocPage != null && ++page <= 3) {
                //     log.debug("$$$$$$$$$$$$$$$$$$ PAGE " + page);
                //     ocPage = actPubService.getOrderedCollectionPage(outbox.getStr("next"));
                // }
            }
        } finally {
        }
    }
}
