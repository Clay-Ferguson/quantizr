package org.subnode.test;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component("ActPubTest")
public class ActPubTest implements TestIntf {
    private static final Logger log = LoggerFactory.getLogger(ActPubTest.class);

    @Override
    public void test() throws Exception {
        try {
           log.debug("Running ActPubTest.");
        } finally {
        }
    }
}
