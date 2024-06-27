package quanta.util;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import quanta.AppServer;
import quanta.config.ServiceBase;
import quanta.config.SessionContext;
import quanta.exception.base.RuntimeEx;
import quanta.mongo.MongoSession;
import quanta.perf.PerfMon;
import quanta.perf.PerfMonEvent;
import quanta.request.LogoutRequest;
import quanta.request.base.RequestBase;
import quanta.response.base.ResponseBase;

@Component
public class CallProcessor extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(CallProcessor.class);
    private static boolean logResponses = false;

    /*
     * Wraps the processing of any command by using whatever info is on the session and/or the request
     * to perform the login if the user is not logged in, and then call the function to be processed
     */
    public Object run(String command, boolean authBearer, boolean authSig, RequestBase req, HttpSession httpSession,
            MongoRunnableEx<Object> runner) {
        if (AppServer.isShuttingDown()) {
            throw ExUtil.wrapEx("Server not available.");
        }
        SessionContext sc = ThreadLocals.getSC();
        sc.setCommand(command);

        if (authBearer) {
            user.authBearer();
        }

        /*
         * #sig: this works fine, but I'm disabling for now (except for admin) until there's a better way to
         * inform the user that this can happen when their key on their browser is different than expected,
         * which CAN even happen simply from using a different browser that hasn't had the signature key
         * imported into it. And also all the flow around how this can be encountered during login/logout
         * needs to be tested and more well thought out.
         */
        if (authSig && sc.isAdmin()) {
            crypto.authSig();
        }

        logRequest(command, req, httpSession);
        /*
         * Instantiating this, runs its constructor and ensures our threadlocal at least has response object
         * on it, but most (not all) implementations of methods end up instantiating their own which
         * overwrites this
         */
        ResponseBase orb = new ResponseBase();
        Object ret = null;
        long startTime = System.currentTimeMillis();
        String userName = null;

        try {
            if (req instanceof LogoutRequest) {
                // Note: all this run will be doing in this case is a session invalidate.
                ret = runner.run(null);
            } else {
                userName = sc.getUserName();
                MongoSession ms = ThreadLocals.getMongoSession();
                ret = runner.run(ms);
                update.saveSession(ms);
            }

            if (ret instanceof ResponseBase _ret) {
                orb = _ret;
                if (orb.getCode() == null) {
                    orb.setCode(HttpServletResponse.SC_OK);
                }
                setResponse(orb, orb.getCode(), null);
            }
        } catch (RuntimeEx e) {
            if (ret == null)
                ret = orb;
            if (ret instanceof ResponseBase) {
                // NOTE: Do not rethrow (return via http, code 200) in this case
                setResponse(orb, e.getCode(), e);
            }
        } catch (Exception e) {
            if (ret == null)
                ret = orb;
            if (ret instanceof ResponseBase) {
                // NOTE: Do not rethrow (return via http, code 200) in this case
                setResponse(orb, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, e);
            } else {
                log.debug("ERROR: " + ExceptionUtils.getStackTrace(e));
            }
        } finally {
            int duration = (int) (System.currentTimeMillis() - startTime);
            if (duration > PerfMon.CAPTURE_THRESHOLD) {
                new PerfMonEvent(duration, "callProc." + command, userName);
            }
        }

        if (ret instanceof ResponseBase _ret) {
            String callId = ThreadLocals.getServletRequest().getHeader("callId");
            _ret.setReplica("callId=" + callId + " Slot=" + prop.getSwarmTaskSlot() + " ID=" + prop.getSwarmTaskId());
            log.trace("RES=" + XString.prettyPrint(ret));

            // make sure whatever ResponseBase we ended up with here (may change during processing) is set in
            // the thread to the AppFilter can pick it up, although it currently not used.
            ThreadLocals.setResponse((ResponseBase) ret);
        }
        return ret;
    }

    private void setResponse(ResponseBase orb, int code, Exception e) {
        orb.setCode(code);

        // If this is an error condition and there's no message set then set one.
        if (code != HttpServletResponse.SC_OK || e != null) {
            // only set a message if one is not already set
            if (StringUtils.isEmpty(orb.getMessage())) {
                // if it's an exception and the exception has ap message, show that message
                if (e != null && e.getMessage() != null) {
                    orb.setMessage("Failed: " + e.getMessage());
                }
                // otherwise show a generic message
                else {
                    orb.setMessage("Oops, something went wrong.");
                }
            }
        }

        if (e != null && orb.getStackTrace() == null) {
            String stack = ExceptionUtils.getStackTrace(e);
            log.debug("ERROR: " + stack);
            orb.setStackTrace(stack);
        }

        if (logResponses) {
            log.debug("ORB: " + XString.prettyPrint(orb));
        }
    }

    private static void logRequest(String url, Object req, HttpSession httpSession) {
        log.trace("REQ=" + url + " " + (req == null ? "none" : XString.prettyPrint(req)));
    }
}
