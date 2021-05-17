package org.subnode.test;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.subnode.actpub.APConst;
import org.subnode.actpub.ActPubFollowing;
import org.subnode.actpub.ActPubUtil;
import org.subnode.actpub.model.APObj;
import org.subnode.config.AppProp;
import org.subnode.util.XString;

@Component("ActPubTest")
public class ActPubTest implements TestIntf {
    private static final Logger log = LoggerFactory.getLogger(ActPubTest.class);

    @Autowired
    private AppProp appProp;

    @Autowired
    private ActPubUtil apUtil;

    @Autowired
    private ActPubFollowing apFollowing;

    @Override
    public void test() throws Exception {
        try {
            log.debug("Running ActPubTest: Host " + appProp.getHostAndPort());
            if (appProp.getHostAndPort().contains("//q2:")) {
                testConnection("q1:8182");
            }
        } finally {
        }
    }

    /**
     * Do basic validation that we can connect to targetHost
     */
    private void testConnection(String targetHostAndPort) throws Exception {
        /* ----- GET WEBFINGER ----- */

        String targetUser = "bob";
        String webFingerUrl = targetUser + "@" + targetHostAndPort;

        APObj webFinger = apUtil.getWebFingerSec(webFingerUrl, false);
        if (webFinger == null) {
            throw new Exception("Unable to get webFinger of " + webFingerUrl);
        }

        log.debug("Got WebFinger ok: " + XString.prettyPrint(webFinger));

        /* ----- GET ACTOR ----- */
        String actorUrl = apUtil.getActorUrlFromWebFingerObj(webFinger);
        APObj actorObj = apUtil.getJson(actorUrl, APConst.MT_APP_ACTJSON);
        if (actorObj == null) {
            throw new Exception("Unable to get actor: " + actorUrl);
        }

        log.debug("Got Actor ok: " + XString.prettyPrint(actorObj));

        /* ===== Follow User ===== */
        apFollowing.setFollowing("adam", targetUser + "@" + targetHostAndPort, true);
    }
}
