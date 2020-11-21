package org.subnode.test;

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
            log.debug("$$$$$$$$$$$$$$$$$$$$ Running ActPubTest.");
            // https://fosstodon.org/.well-known/webfinger?resource=acct:WClayFerguson@fosstodon.org'
            actPubService.getWebFinger("https://fosstodon.org", "WClayFerguson@fosstodon.org");
        } finally {
        }
    }
}
