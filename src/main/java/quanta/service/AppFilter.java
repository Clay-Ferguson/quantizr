package quanta.service;

import java.io.IOException;
import java.util.Collection;
import java.util.Date;
import java.util.Enumeration;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.GenericFilterBean;
import quanta.config.ServiceBase;
import quanta.config.SessionContext;
import quanta.exception.ServerTooBusyException;
import quanta.exception.UnauthorizedException;
import quanta.exception.base.RuntimeEx;
import quanta.util.Const;
import quanta.util.ExUtil;
import quanta.util.TL;
import quanta.util.Util;
import quanta.util.XString;

/**
 * Filter for logging details of any request/response
 */
// See AppConfiguration.java for Bean Registration
@Component 
public class AppFilter extends GenericFilterBean {
    private static Logger log = LoggerFactory.getLogger(AppFilter.class);
    private static String INDENT = "    ";
    public static String SESSION_LOCK_NAME = "sLock";

    // turns on FULL and verbose logging
    public static boolean audit = false;

    // turns on some logging (not too verbose)
    public static boolean debug = true;

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {
        if (!Util.gracefulReadyCheck(res))
            return;

        String token = null;
        SessionContext sc = null;
        HttpServletRequest httpReq = (HttpServletRequest) req;
        HttpServletResponse httpRes = (HttpServletResponse) res;
        HttpSession session = null;
        boolean newSession = false;
        ReentrantLock mutex = null;

        try {
            TL.removeAll();
            TL.setServletRequest(httpReq);
            TL.setServletResponse(httpRes);

            // test if we have a session before creating it.
            session = httpReq.getSession(false);
            newSession = (session == null);

            // always create session immediately so we get concurrency mutexing
            if (session == null) {
                session = httpReq.getSession(true);
            }
            TL.setHttpSession(session);

            mutex = getMutex(httpReq, session);
            logUrlAndParams(httpReq);

            if (audit) {
                preProcess(httpReq);
            }

            token = getToken(httpReq, session);
            TL.setReqSig(httpReq.getHeader("Sig"));
            sc = getScFromRedis(token, sc, session);

            boolean newSc = false;
            if (sc == null) {
                // log.debug("REDIS has no session context yet. Setting as anonymous");
                // anonymous user
                sc = new SessionContext();
                newSc = true;
            }
            // else {
            //     log.debug("Redis has SessionContext with user: " + sc.getUserName());
            // }
            Date now = new Date();
            sc.setLastActiveTime(now.getTime());
            TL.setSC(sc);
            chain.doFilter(req, res);

            // detect if we did a login just now and set token on session.
            if (token == null && sc.getUserToken() != null) {
                session.setAttribute(Const.BEARER_TOKEN, sc.getUserToken());
                if (newSession) {
                    log.debug("New Session: User: " + sc.getUserName() + " SessId=" + session.getId() + " token="
                            + sc.getUserToken());
                }
            }

            if (sc.getUserToken() != null) {
                ServiceBase.svc_redis.save(TL.getSC());
                if (newSc) {
                    log.debug("First Save of RedisKey: " + sc.getUserToken());
                }
            }
        } catch (RuntimeEx e) {
            /*
             * NOTE: Normal flow for this exception case is NOT thru here by by a successful code=200 with the
             * error code embedded in a ResponseBase.code. This exception is just a 'catch all' for being able
             * to still respond to this error even in the case where no ResponseBase is being returned which is
             * rare but is still possible
             */
            sendError(httpRes, e.getMessage() != null ? e.getMessage() : httpReq.getRequestURI(), e.getCode(), e);
        } catch (Exception e) {
            // ditto comment above
            sendError(httpRes, e.getMessage() != null ? e.getMessage() : httpReq.getRequestURI(),
                    HttpServletResponse.SC_INTERNAL_SERVER_ERROR, e);
        } finally {
            if (mutex != null) {
                mutex.unlock();
            }
            TL.removeAll();
            if (audit) {
                if (res instanceof HttpServletResponse sres) {
                    postProcess(httpReq, sres);
                }
            }
        }
    }

    private SessionContext getScFromRedis(String token, SessionContext sc, HttpSession session) {
        if (!StringUtils.isEmpty(token)) {
            sc = ServiceBase.svc_redis.get(token);

            // if bad or unknown token.
            if (sc == null) {
                // Don't throw exception here, because we need to just recover this session but with a fresh
                // SessionContext, and so leaving sc==null will do this.
                // session.removeAttribute(Const.BEARER_TOKEN);
                throw new UnauthorizedException();
            } else {
                // log.debug("REDIS: usr=" + sc.getUserName() + " token=" + sc.getUserToken());
                TL.setReqBearerToken(token);
            }
        }
        return sc;
    }

    private ReentrantLock getMutex(HttpServletRequest httpReq, HttpSession session) throws InterruptedException {
        boolean useLock = true;
        // bypass locking for these
        switch (httpReq.getRequestURI()) {
            case AppController.API_PATH + "/serverPush":
            case AppController.API_PATH + "/signNodes":
            case AppController.API_PATH + "/getOpenGraph":
            case AppController.API_PATH + "/health":
            case AppController.API_PATH + "/bin":
                useLock = false;
                break;
            default:
                break;
        }

        ReentrantLock mutex = null;
        if (useLock) {
            mutex = (ReentrantLock) session.getAttribute(AppFilter.SESSION_LOCK_NAME);
            if (mutex != null) {
                boolean isLockAcquired = mutex.tryLock(30, TimeUnit.SECONDS);
                if (!isLockAcquired) {
                    throw new ServerTooBusyException("MUTEX: Failed to acquire lock for " + httpReq.getRequestURI());
                }
            }
        }
        return mutex;
    }

    private void logUrlAndParams(HttpServletRequest httpReq) {
        if (Const.debugFilterEntry || debug) {
            String url = "URI=" + httpReq.getRequestURI();
            if (httpReq.getQueryString() != null) {
                url += " q=" + httpReq.getQueryString();
            }
            Map<?, ?> params = httpReq.getParameterMap();
            if (params != null && params.size() > 0) {
                url += "\n    Params: " + XString.prettyPrint(httpReq.getParameterMap());
            }
            log.debug(url);
        }
    }

    private String getToken(HttpServletRequest httpReq, HttpSession session) {
        // first try to get the token from the HTTP header
        String token = httpReq.getHeader("Bearer");

        // second, allow token to be specified in URL as well
        if (StringUtils.isEmpty(token)) {
            token = httpReq.getParameter(Const.BEARER_TOKEN);
        }

        // and finally get token from session if still null
        // NOTE: Do we need this? It seems like we should always get the token from the header or URL
        if (StringUtils.isEmpty(token)) {
            token = (String) session.getAttribute(Const.BEARER_TOKEN);
        }
        return token;
    }

    private void sendError(HttpServletResponse res, String msg, int code, Exception e) {
        ExUtil.error(log, "Failed in " + msg, e);
        try {
            res.getWriter().write(msg);
            res.sendError(code);
        } catch (Exception ex) {
        }
    }

    private String getConfigParamInfo() {
        StringBuilder sb = new StringBuilder();
        Enumeration<?> en = getFilterConfig().getInitParameterNames();
        if (en != null) {
            while (en.hasMoreElements()) {
                String param = (String) en.nextElement();
                sb.append(INDENT);
                sb.append(param);
                sb.append(": ");
                sb.append(getFilterConfig().getInitParameter(param));
                sb.append("\n");
            }
        }
        return sb.toString();
    }

    public static String getRequestInfo(HttpServletRequest sreq) {
        StringBuilder sb = new StringBuilder();
        sb.append(INDENT);
        sb.append("meth url: ");
        sb.append(sreq.getMethod());
        sb.append(" ");
        sb.append(sreq.getRequestURI());
        sb.append("\n");
        sb.append(INDENT);
        sb.append("proto path: ");
        sb.append(sreq.getProtocol());
        sb.append(" ");
        sb.append(sreq.getServletPath());
        sb.append("\n");
        if (sreq.getPathInfo() != null || sreq.getPathTranslated() != null) {
            sb.append(INDENT);
            sb.append("pinfo -> ptrans: ");
            sb.append(sreq.getPathInfo());
            sb.append(" -> ");
            sb.append(sreq.getPathTranslated());
            sb.append("\n");
        }
        if (sreq.getQueryString() != null) {
            sb.append(INDENT);
            sb.append("q: ");
            sb.append(sreq.getQueryString());
            sb.append("\n");
        }
        sb.append(INDENT);
        sb.append("len typ: ");
        sb.append(sreq.getContentLength());
        sb.append(" ");
        sb.append(sreq.getContentType());
        sb.append("\n");
        sb.append(INDENT);
        sb.append("server port usr: ");
        sb.append(sreq.getServerName());
        sb.append(" ");
        sb.append(sreq.getServerPort());
        sb.append(" ");
        sb.append(sreq.getRemoteUser());
        sb.append("\n");
        sb.append(INDENT);
        sb.append("adrs host auth: ");
        sb.append(sreq.getRemoteAddr());
        sb.append(" ");
        sb.append(sreq.getRemoteHost());
        sb.append(" ");
        sb.append(sreq.getAuthType());
        sb.append("\n");
        return sb.toString();
    }

    private String getHeaderInfo(HttpServletRequest sreq) {
        StringBuilder sb = new StringBuilder();
        Enumeration<?> e = sreq.getHeaderNames();
        if (e.hasMoreElements()) {
            sb.append("headers:\n");

            while (e.hasMoreElements()) {
                String name = (String) e.nextElement();
                sb.append(INDENT);
                sb.append(name);
                sb.append(": ");
                sb.append(sreq.getHeader(name));
                sb.append("\n");
            }
        }
        return sb.toString();
    }

    private String getHeaderInfo(HttpServletResponse sres) {
        StringBuilder sb = new StringBuilder();
        Collection<String> names = sres.getHeaderNames();
        if (names.size() > 0) {
            sb.append("headers:\n");

            for (String name : names) {
                sb.append(INDENT);
                sb.append(name);
                sb.append(": ");
                sb.append(sres.getHeader(name));
                sb.append("\n");
            }
        }
        return sb.toString();
    }

    private String getParameterInfo(HttpServletRequest sreq) {
        StringBuilder sb = new StringBuilder();
        Enumeration<?> e = sreq.getParameterNames();
        if (e.hasMoreElements()) {
            sb.append("Servlet parameters (Multiple Value style):\n");

            while (e.hasMoreElements()) {
                String name = (String) e.nextElement();
                String[] vals = (String[]) sreq.getParameterValues(name);
                if (vals != null) {
                    sb.append(INDENT);
                    sb.append("[");
                    sb.append(name);
                    sb.append("]=");
                    sb.append(vals[0]);

                    for (int i = 1; i < vals.length; i++) {
                        sb.append(INDENT);
                        sb.append(INDENT); // double indent (not a typo)
                        sb.append(vals[i]);
                        sb.append("\n");
                    }
                }
                sb.append("\n");
            }
        }
        return sb.toString();
    }

    private String getAttributeInfo(HttpServletRequest sreq) {
        StringBuilder sb = new StringBuilder();
        Object reqAttrs = sreq.getAttributeNames();
        if (reqAttrs != null && reqAttrs instanceof Enumeration<?> attrs) {
            sb.append("Req Attrs:\n");

            while (attrs.hasMoreElements()) {
                String attr = attrs.nextElement().toString();
                if (sreq.getAttribute(attr) != null) {
                    sb.append(INDENT);
                    sb.append(attr);
                    sb.append("=");
                    sb.append(sreq.getAttribute(attr).toString());
                } else {
                    sb.append(INDENT);
                    sb.append(attr);
                    sb.append("=null");
                }
                sb.append("\n");
            }
        }
        return sb.toString();
    }

    private String getSessionAttributeInfo(HttpServletRequest sreq) {
        HttpSession session = ((HttpServletRequest) sreq).getSession(false);
        if (session == null) {
            return "[no session]\n";
        }
        StringBuilder sb = new StringBuilder();
        Object sessionAattrs = session.getAttributeNames();
        if (sessionAattrs != null && sessionAattrs instanceof Enumeration<?> attrs) {
            sb.append("Sess Attrs:\n");

            while (attrs.hasMoreElements()) {
                String attr = attrs.nextElement().toString();
                if (session.getAttribute(attr) != null) {
                    sb.append(INDENT);
                    sb.append(attr);
                    sb.append(" = ");
                    sb.append(session.getAttribute(attr).toString());
                } else {
                    sb.append(INDENT);
                    sb.append(attr);
                    sb.append("=null");
                }
                sb.append("\n");
            }
        }
        return sb.toString();
    }

    private String getRequestParameterInfo(HttpServletRequest sreq) {
        Enumeration<?> e = sreq.getParameterNames();
        StringBuilder sb = new StringBuilder();
        if (e.hasMoreElements()) {
            sb.append("Servlet parameters (Single Value style):\n");

            while (e.hasMoreElements()) {
                String name = (String) e.nextElement();
                sb.append(INDENT + name + " = " + sreq.getParameter(name) + "\n");
            }
        }
        return sb.toString();
    }

    private void preProcess(HttpServletRequest sreq) {
        if (sreq == null)
            return;
        // // NON-VERBOSE Logging
        // if (log.isDebugEnabled() && !log.isTraceEnabled()) {
        // StringBuilder sb = new StringBuilder();
        // sb.append("REQ: ");
        // sb.append(sreq.getMethod());
        // sb.append(" ");
        // sb.append(sreq.getRequestURI());
        // if (sreq.getQueryString() != null) {
        // sb.append(" -> ");
        // sb.append(sreq.getQueryString());
        // }
        // sb.append(" [from ");
        // sb.append(sreq.getRemoteAddr());
        // sb.append("]");
        // // sb.append(" SpringAuth=" + Util.isSpringAuthenticated());
        // log.debug(sb.toString());
        // } //
        if (audit) { // VERBOSE Logging
            try {
                StringBuilder sb = new StringBuilder();
                sb.append("\n>\n");
                sb.append(getConfigParamInfo());
                sb.append(getRequestInfo(sreq));
                sb.append(getRequestParameterInfo(sreq));
                sb.append(getHeaderInfo(sreq));
                sb.append(getParameterInfo(sreq));
                sb.append(getAttributeInfo(sreq));
                sb.append(getSessionAttributeInfo(sreq));
                // sb.append(" SpringAuth=" + Util.isSpringAuthenticated());
                log.debug(sb.toString());
            } catch (Exception e) {
                log.error("error", e);
            }
        }
    }

    private void postProcess(HttpServletRequest sreq, HttpServletResponse sres) {
        try {
            if (sreq == null || sres == null)
                return;
            StringBuilder sb = new StringBuilder();
            sb.append("\n<: RET_CODE=" + String.valueOf(sres.getStatus()) + " mime=" + sres.getContentType() + "\n");
            sb.append(getHeaderInfo(sres));
            sb.append(getSessionAttributeInfo(sreq));
            sb.append("++++++\n");
            log.debug(sb.toString());
        } catch (Exception e) {
            log.error("error", e);
        }
    }

    public void destroy() {}
}
