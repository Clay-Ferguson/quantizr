package quanta.filter;

import java.io.IOException;
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
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.GenericFilterBean;
import quanta.config.SessionContext;
import quanta.model.client.PrincipalName;
import quanta.mongo.MongoRepository;
import quanta.util.ThreadLocals;
import quanta.util.Util;
import quanta.util.XString;
import static quanta.util.Util.*;

/**
 * This is Web Filter for processing AppController.API_PATH endpoints(path configured in
 * AppConfiguration.java)
 */
@Component
@Order(4)
public class AppFilter extends GenericFilterBean {
	private static final Logger log = LoggerFactory.getLogger(AppFilter.class);

	private static int reqId = 0;
	private static boolean logRequests = true;
	private static boolean logResponses = false;

	/*
	 * if non-zero this is used to put a millisecond delay (determined by its value) onto every request
	 * that comes thru as an API call.
	 */
	private static int simulateSlowServer = 0;

	@Override
	public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain) throws IOException, ServletException {
		if (!MongoRepository.fullInit) {
			throw new RuntimeException("Server temporarily offline.");
		}

		HttpServletResponse httpRes = null;
		try {
			ThreadLocals.removeAll();
			ThreadLocals.setStopwatchTime(System.currentTimeMillis());
			int thisReqId = ++reqId;

			HttpServletRequest httpReq = null;
			HttpSession session = null;
			if (req instanceof HttpServletRequest) {
				// log.debug("***** SC: User: " + sc.getUserName());

				httpReq = (HttpServletRequest) req;
				httpRes = (HttpServletResponse) res;

				log.trace(httpReq.getRequestURI() + " -> " + httpReq.getQueryString());
				session = httpReq.getSession(true);
				SessionContext sc = SessionContext.init(session);

				sc.addAction(httpReq.getRequestURI());
				String bearer = httpReq.getHeader("Bearer");

				/*
				 * if auth token is privided and doesn't exist that's a timed out session so send user back to
				 * welcome page. Should also blow away all browser memory. New browser page load.
				 */
				if (!StringUtils.isEmpty(bearer) && !SessionContext.validToken(bearer, null)) {
					// just ignore an invalid token like it was not there.
					log.trace("Ignoring bad bearer token: " + bearer);
					bearer = null;
					sc.setUserName(PrincipalName.ANON.s());
				}

				// if no bearer is given, and no userName is set, then set to ANON
				if (no(bearer) && no(sc.getUserName())) {
					sc.setUserName(PrincipalName.ANON.s());
				}

				// for paths that require a user check bearer token.
				if (isSecurePath(httpReq.getRequestURI())) {
					checkApiSecurity(bearer, httpReq, sc);
				}

				sc.setIp(Util.getClientIpAddr(httpReq));
				ThreadLocals.setHttpSession(session);

				if (simulateSlowServer > 0) {
					Util.sleep(simulateSlowServer);
				}

				if (logRequests) {
					String url = "REQ[" + String.valueOf(thisReqId) + "]: URI=" + httpReq.getRequestURI() + "  QueryString="
							+ httpReq.getQueryString();
					log.debug(url + "\nParameters: " + XString.prettyPrint(httpReq.getParameterMap()));
				}
			} else {
				// log.debug("******* req class: "+req.getClass().getName());
			}

			if (res instanceof HttpServletResponse) {
				ThreadLocals.setServletResponse((HttpServletResponse) res);
			}

			try {
				chain.doFilter(req, res);
				if (logResponses) {
					log.debug("    RES: [" + String.valueOf(thisReqId) + "]" /* +httpRes.getStatus() */
							+ HttpStatus.valueOf(httpRes.getStatus()));
				}
			} catch (RuntimeException ex) {
				log.error("Failed", ex);
				throw ex;
			}
		} catch (Exception e) {
			/*
			 * we send back the error here, for AJAX calls so we don't bubble up to the default handling and
			 * cause it to send back the html error page.
			 */
			httpRes.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
		} finally {
			/* Set thread back to clean slate, for it's next cycle time in threadpool */
			ThreadLocals.removeAll();
		}
	}

	/*
	 * Secure path check requires a non-anonymous user to be on this session and also already
	 * authenticated
	 */
	private void checkApiSecurity(String bearer, HttpServletRequest req, SessionContext sc) {
		// otherwise require secure header
		if (no(bearer)) {
			throw new RuntimeException("Auth failed. no bearer token: " + req.getRequestURI());
		}

		if (!SessionContext.validToken(bearer, sc.getUserName())) {
			throw new RuntimeException("Auth failed. Invalid bearer token: " + bearer + " " + req.getRequestURI());
		} else {
			// log.debug("Bearer accepted: " + bearer);
		}
	}

	// todo-1: app is too fragile if you forget to add one here. fix this.
	private boolean isSecurePath(String path) {
		// todo-1: /bin & /stream is an unusual case: can be ../bin/avatar or just ../bin
		if (
		// CONTAINS
		// ========
		path.contains("/bin") || //
				path.contains("/stream") || //

				// ENDS WITH
				// =========
				path.endsWith("/login") || //
				path.endsWith("/signup") || //
				path.endsWith("/savePublicKey") || //
				path.endsWith("/changePassword") || //
				path.endsWith("/getConfig") || //
				path.endsWith("/serverPush") || //
				path.endsWith("/renderNode") || //
				path.endsWith("/getNodeMetaInfo") || //
				path.endsWith("/captcha") || //
				path.endsWith("/getUserProfile") || //
				path.endsWith("/nodeFeed") || //
				path.endsWith("/getFollowers") || //
				path.endsWith("/getFollowing") || //
				path.endsWith("/nodeSearch") || //
				path.endsWith("/graphNodes") || //
				path.endsWith("/resetPassword") || //
				path.endsWith("/getNodeStats") || //
				path.endsWith("/getUserAccountInfo") || //
				path.endsWith("/anonPageLoad") || //
				path.endsWith("/getOpenGraph") || //
				path.endsWith("/getMultiRssFeed")) {
			return false;
		}
		return true;
	}
}