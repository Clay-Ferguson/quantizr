package quanta.test;

import static quanta.util.Util.no;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import quanta.actpub.APConst;
import quanta.actpub.ActPubFollower;
import quanta.actpub.ActPubFollowing;
import quanta.actpub.ActPubUtil;
import quanta.actpub.model.APObj;
import quanta.config.AppProp;
import quanta.util.XString;

@Lazy
@Component("ActPubTest")
public class ActPubTest implements TestIntf {
    private static final Logger log = LoggerFactory.getLogger(ActPubTest.class);

    @Autowired
    @Lazy
    private AppProp appProp;

    @Autowired
    @Lazy
    private ActPubUtil apUtil;

    @Autowired
    @Lazy
    private ActPubFollowing apFollowing;

    @Autowired
    @Lazy
    protected ActPubFollower apFollower;

    @Override
    public void test() throws Exception {
        try {
            log.debug("Running ActPubTest: Host " + appProp.getHostAndPort());
            if (appProp.getHostAndPort().contains("//q2:")) {
                testConnection("q1:8184");
            }
        } finally {
        }
    }

    /**
     * Do basic validation that we can connect to targetHost
     */
    private void testConnection(String targetHostAndPort) throws Exception {
        log.debug("Testing Connection to: " + targetHostAndPort);
        /* ----- GET WEBFINGER ----- */

        String targetUser = "bob";
        String webFingerUrl = targetUser + "@" + targetHostAndPort;

        APObj webFinger = apUtil.getWebFingerSec(webFingerUrl, false);
        if (no(webFinger)) {
            throw new Exception("Unable to get webFinger of " + webFingerUrl);
        }

        log.debug("Got WebFinger ok: " + XString.prettyPrint(webFinger));

        /* ----- GET ACTOR ----- */
        String actorUrl = apUtil.getActorUrlFromWebFingerObj(webFinger);
        APObj actorObj = apUtil.getJson(actorUrl, APConst.MTYPE_ACT_JSON, 10);
        if (no(actorObj)) {
            throw new Exception("Unable to get actor: " + actorUrl);
        }

        log.debug("Got Actor ok: " + XString.prettyPrint(actorObj));

        /* ===== Follow User ===== */
        apFollowing.setFollowing("adam", targetUser + "@" + targetHostAndPort, true);
    }
}
