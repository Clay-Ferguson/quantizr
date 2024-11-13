package quanta.util;

import java.util.function.Supplier;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import quanta.AppServer;
import quanta.config.ServiceBase;
import quanta.exception.base.RuntimeEx;
import quanta.perf.PerfEvent;
import quanta.rest.request.base.RequestBase;
import quanta.rest.response.base.ResponseBase;

@Component
public class CallProcessor extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(CallProcessor.class);
    private static boolean logRequests = true; // todo-2: make these flags able to be set by admin at runtime.
    private static boolean logResponses = false;

    /*
     * Wraps the processing of any command by using whatever info is on the session and/or the request
     * to perform the login if the user is not logged in, and then call the function to be processed.
     * 
     * @authBearer: if true, then the request must have a valid `Bearer` token in the header, or a valid
     * `token` in the requests url, or in the session (see AppFilter.getToken() for details), or else we
     * fail with a security error.
     */
    public Object run(String command, boolean authBearer, boolean authSig, RequestBase req, HttpSession httpSession,
            Supplier<Object> runner) {
        if (AppServer.isShuttingDown()) {
            throw new RuntimeEx("Server not available.");
        }

        // Note: TL.setSC() will have already been called in a web filter
        TL.getSC().setCommand(command);

        if (authBearer) {
            svc_user.authBearer();
        }

        /*
         * #sig: exception to inform the user that when their key on their browser is different than
         * expected, which CAN even happen simply from using a different browser that hasn't had the
         * signature key imported into it. And also all the flow around how this can be encountered during
         * login/logout needs to be tested and more well thought out.
         */
        if (authSig && TL.hasAdminPrivileges()) {
            svc_crypto.authSig();
        }

        if (logRequests) {
            logRequest(command, req, httpSession);
        }
        /*
         * Instantiating this, runs its constructor and ensures our threadlocal at least has response object
         * on it, but most (not all) implementations of methods end up instantiating their own which
         * overwrites this
         */
        ResponseBase orb = new ResponseBase();
        Object ret = null;

        try (PerfEvent pe = new PerfEvent("rpc." + command, TL.getSC().getUserName())) {
            ret = runner.get();
            svc_mongoUpdate.saveSession();

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
        }

        if (ret instanceof ResponseBase _ret) {
            String callId = TL.getServletRequest().getHeader("callId");
            _ret.setReplica(
                    "callId=" + callId + " Slot=" + svc_prop.getSwarmTaskSlot() + " ID=" + svc_prop.getSwarmTaskId());
            log.trace("RES=" + XString.prettyPrint(ret));

            // make sure whatever ResponseBase we ended up with here (may change during processing) is set in
            // the thread to the AppFilter can pick it up, although it currently not used.
            TL.setResponse((ResponseBase) ret);
        }
        return ret;
    }

    private void setResponse(ResponseBase orb, int code, Exception e) {
        orb.setCode(code);

        // If this is an error condition and there's no message set then set one.
        if (code != HttpServletResponse.SC_OK || e != null) {
            // only set a message if one is not already set
            if (StringUtils.isEmpty(orb.getMessage())) {
                // If this is one of our own exceptions we can show the message text to the user.
                if (e instanceof RuntimeEx) {
                    orb.setMessage("Message: " + e.getMessage());
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
            log.debug("RES=" + XString.prettyPrint(orb));
        }
    }

    private static void logRequest(String url, Object req, HttpSession httpSession) {
        log.debug("REQ=" + url + " sessionId=" + httpSession.getId() + " "
                + (req == null ? "none" : XString.prettyPrint(req)));
    }
}
