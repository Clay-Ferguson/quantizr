package quanta.service;

import java.io.IOException;
import java.util.Collection;
import java.util.Date;
import java.util.Enumeration;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;
import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.GenericFilterBean;
import quanta.AppController;
import quanta.config.ServiceBase;
import quanta.config.SessionContext;
import quanta.exception.base.RuntimeEx;
import quanta.util.Const;
import quanta.util.ExUtil;
import quanta.util.ThreadLocals;
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
    public static boolean debug = false;
    public static String BEARER_TOKEN = "token";

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
        boolean isNewSession = false;
        ReentrantLock mutex = null;
        boolean useLock = true;

        try {
            ThreadLocals.removeAll();
            ThreadLocals.setServletRequest(httpReq);
            ThreadLocals.setServletResponse(httpRes);

            // test if we have a session before creating it.
            session = httpReq.getSession(false);
            isNewSession = (session == null);

            // always create session immediately so we get concurrency mutexing
            session = httpReq.getSession(true);
            ThreadLocals.setHttpSession(session);

            // bypass locking for these two
            switch (httpReq.getRequestURI()) {
                // todo-1: need to add everything else we can that we KNOW can run concurrently to any user's
                // session
                case AppController.API_PATH + "/serverPush":
                case AppController.API_PATH + "/signNodes":
                case AppController.API_PATH + "/getOpenGraph":
                case AppController.API_PATH + "/health":
                    useLock = false;
                    break;
                default:
                    break;
            }

            if (useLock) {
                mutex = (ReentrantLock) session.getAttribute(AppFilter.SESSION_LOCK_NAME);
                if (mutex != null) {
                    boolean isLockAcquired = mutex.tryLock(30, TimeUnit.SECONDS);
                    if (!isLockAcquired)
                        throw new RuntimeException("Server too busy.");
                }
            }

            if (Const.debugFilterEntry || debug) {
                String url = "URI=" + httpReq.getRequestURI();
                if (httpReq.getQueryString() != null) {
                    url += " q=" + httpReq.getQueryString();
                }
                Map params = httpReq.getParameterMap();
                if (params != null && params.size() > 0) {
                    url += "\n    Params: " + XString.prettyPrint(httpReq.getParameterMap());
                }
                log.debug(url);
            }

            if (audit) {
                preProcess(httpReq);
            }
            token = httpReq.getHeader("Bearer");

            // allow token to be specified in URL as well
            if (StringUtils.isEmpty(token)) {
                token = httpReq.getParameter(BEARER_TOKEN);
            }

            if (StringUtils.isEmpty(token) && session != null) {
                token = (String) session.getAttribute(BEARER_TOKEN);
            }

            ThreadLocals.setReqSig(httpReq.getHeader("Sig"));

            if (!StringUtils.isEmpty(token)) {
                sc = ServiceBase.redis.get(token);

                // if bad or unknown token.
                if (sc == null) {
                    // Don't throw exception here, because we need to just recover this session but with a fresh
                    // SessionContext, and so leaving sc==null will do this.
                    // throw new UnauthorizedException();
                    session.removeAttribute(BEARER_TOKEN);
                } else {
                    // log.debug("REDIS: usr=" + sc.getUserName() + " token=" + sc.getUserToken());
                    ThreadLocals.setReqBearerToken(token);
                }
            }

            boolean newSc = false;
            if (sc == null) {
                // anonymous user
                sc = new SessionContext();
                newSc = true;
            }
            Date now = new Date();
            sc.setLastActiveTime(now.getTime());

            ThreadLocals.setSC(sc);
            chain.doFilter(req, res);

            // detect if we did a login just now and set token on session.
            if (token == null && sc.getUserToken() != null) {
                session.setAttribute(BEARER_TOKEN, sc.getUserToken());

                if (isNewSession) {
                    log.debug("New Session: User: " + sc.getUserName() + " SessId=" + session.getId() + " token="
                            + sc.getUserToken());
                }
            }

            if (sc.getUserToken() != null) {
                ServiceBase.redis.save(ThreadLocals.getSC());
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
            sendError(httpRes, httpReq.getRequestURI(), e.getCode(), e);
        } catch (Exception e) {
            // ditto comment above
            sendError(httpRes, httpReq.getRequestURI(), HttpServletResponse.SC_INTERNAL_SERVER_ERROR, e);
        } finally {
            if (mutex != null) {
                mutex.unlock();
            }

            ThreadLocals.removeAll();

            if (audit) {
                if (res instanceof HttpServletResponse) {
                    HttpServletResponse sres = (HttpServletResponse) res;
                    postProcess(httpReq, sres);
                }
            }
        }
    }

    private void sendError(HttpServletResponse res, String msg, int code, Exception e) {
        ExUtil.error(log, "Failed in " + msg, e);
        try {
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
        if (reqAttrs != null && reqAttrs instanceof Enumeration<?>) {
            Enumeration<?> attrs = (Enumeration<?>) reqAttrs;
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
        if (sessionAattrs != null && sessionAattrs instanceof Enumeration<?>) {
            Enumeration<?> attrs = (Enumeration<?>) sessionAattrs;
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

    @SuppressWarnings("unused")
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
