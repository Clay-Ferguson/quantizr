package org.subnode.config;

import java.io.IOException;
import java.util.HashMap;
import javax.annotation.PostConstruct;
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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.GenericFilterBean;
import org.subnode.model.IPInfo;
import org.subnode.model.client.PrincipalName;
import org.subnode.mongo.MongoRepository;
import org.subnode.util.ThreadLocals;
import org.subnode.util.Util;
import org.subnode.util.XString;

/**
 * This is Web Filter for processing AppController.API_PATH endpoints(path configured in
 * AppConfiguration)
 */
@Component
@Order(4)
public class AppFilter extends GenericFilterBean {
	private static final Logger log = LoggerFactory.getLogger(AppFilter.class);

	//todo-0: move all the stuff related to hit counting into a dedicated HitCounterFilter class
	private static final HashMap<String, Integer> uniqueIpHits = new HashMap<>();
	private static int reqId = 0;
	private static boolean logRequests = true;
	private static boolean logResponses = false;

	@Autowired
	private AppProp appProp;

	/*
	 * if non-zero this is used to put a millisecond delay (determined by its value) onto every request
	 * that comes thru as an API call.
	 */
	private static int simulateSlowServer = 0;

	private static boolean THROTTLE_ENABLED = false;
	private static int THROTTLE_INTERVAL = 500;

	/*
	 * For debugging we can turn this flag on and disable the server from processing multiple requests
	 * simultenaously this is every helpful for debugging.
	 */
	private static boolean singleThreadDebugging = false;

	private static final HashMap<String, IPInfo> ipInfo = new HashMap<>();

	@PostConstruct
	public void postConstruct() {
		THROTTLE_INTERVAL = appProp.getThrottleTime();
	}

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
			String ip = null;

			HttpServletRequest httpReq = null;
			HttpSession session = null;
			if (req instanceof HttpServletRequest) {
				// log.debug("***** SC: User: " + sc.getUserName());

				httpReq = (HttpServletRequest) req;
				log.trace(httpReq.getRequestURI() + " -> " + httpReq.getQueryString());
				httpRes = (HttpServletResponse) res;
				session = httpReq.getSession(true);
				SessionContext sc = SessionContext.init(session);

				sc.addAction(httpReq.getRequestURI());
				String bearer = httpReq.getHeader("Bearer");

				// if auth token is privided and doesn't exist that's a timed out session so send user
				// back to welcome page. Should also blow away all browser memory. New browser page load.
				if (!StringUtils.isEmpty(bearer) && !SessionContext.validToken(bearer, null)) {
					// just ignore an invalid token like it was not there.
					log.trace("Ignoring bad bearer token: " + bearer);
					bearer = null;
					sc.setUserName(PrincipalName.ANON.s());
				}

				// if no bearer is given, and no userName is set, then set to ANON
				if (bearer == null && sc.getUserName() == null) {
					sc.setUserName(PrincipalName.ANON.s());
				}

				// for paths that require a user check bearer token.
				if (isSecurePath(httpReq.getRequestURI())) {
					checkApiSecurity(bearer, httpReq, sc);
				}

				ip = getClientIpAddr(httpReq);
				sc.setIp(ip);
				ThreadLocals.setHttpSession(session);
				String queryString = httpReq.getQueryString();

				if (simulateSlowServer > 0) {
					Util.sleep(simulateSlowServer);
				}

				if (logRequests) {
					String url = "REQ[" + String.valueOf(thisReqId) + "]: URI=" + httpReq.getRequestURI() + "  QueryString="
							+ queryString;
					log.debug(url + "\nParameters: " + XString.prettyPrint(httpReq.getParameterMap()));
				}

				updateHitCounter(httpReq);
			} else {
				// log.debug("******* req class: "+req.getClass().getName());
			}

			if (res instanceof HttpServletResponse) {
				ThreadLocals.setServletResponse((HttpServletResponse) res);
			}

			try {
				IPInfo info = null;
				synchronized (ipInfo) {
					info = ipInfo.get(ip);
					if (info == null) {
						ipInfo.put(ip, info = new IPInfo());
					}
				}
				throttleRequest(httpReq, info);

				/*
				 * singleThreadDebugging creates one lock per IP so that each machine calling our server gets single
				 * threaded, but other servers can call in parallel
				 */
				if (singleThreadDebugging) {
					if (ip == null) {
						ip = "unknown";
					}

					synchronized (info.getLock()) {
						chain.doFilter(req, res);
					}
				} else {
					chain.doFilter(req, res);
				}

				if (logResponses) {
					log.debug("    RES: [" + String.valueOf(thisReqId) + "]" /* +httpRes.getStatus() */
							+ HttpStatus.valueOf(httpRes.getStatus()));
				}

			} catch (RuntimeException ex) {
				log.error("Request Failed", ex);
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

	private void throttleRequest(HttpServletRequest httpReq, IPInfo info) {
		if (httpReq == null)
			return;

		long curTime = System.currentTimeMillis();
		if (info.getLastRequestTime() == 0) {
			info.setLastRequestTime(curTime);
			return;
		}

		// log.debug("check:" + httpReq.getRequestURI());
		if (httpReq.getRequestURI().endsWith("/checkMessages") || //
				httpReq.getRequestURI().endsWith("/getUserProfile") || //
				httpReq.getRequestURI().endsWith("/getConfig") || //
				httpReq.getRequestURI().endsWith("/getBookmarks") || //
				httpReq.getRequestURI().endsWith("/login") || //
				httpReq.getRequestURI().endsWith("/proxyGet") || //
				httpReq.getRequestURI().endsWith("/serverPush") || //
				httpReq.getRequestURI().endsWith("/anonPageLoad") || //
				httpReq.getRequestURI().endsWith("/getOpenGraph")) {
			// these have priority
		} else {
			if (THROTTLE_ENABLED) {
				long wait = THROTTLE_INTERVAL - (curTime - info.getLastRequestTime());
				if (wait > 0) {
					log.debug("throt: " + httpReq.getRequestURI() + " " + String.valueOf(wait));
					try {
						Thread.sleep(wait);
					} catch (Exception e) {
					}
				}
			}
		}
		info.setLastRequestTime(System.currentTimeMillis());
	}

	private void updateHitCounter(HttpServletRequest httpReq) {
		String ip = getClientIpAddr(httpReq);

		synchronized (uniqueIpHits) {
			Integer hitCount = ip != null ? uniqueIpHits.get(ip) : null;

			if (hitCount == null) {
				uniqueIpHits.put(ip, 1);
			} else {
				hitCount = hitCount.intValue() + 1;
				uniqueIpHits.put(ip, hitCount);
			}
		}
	}

	/*
	 * I found this code online and it is not fully tested, but according to my research it is the best
	 * way you can try determining the source IP.
	 */
	public static String getClientIpAddr(HttpServletRequest request) {
		String ip = request.getHeader("X-Forwarded-For");
		if (!unknownIp(ip))
			return ip;

		ip = request.getHeader("Proxy-Client-IP");
		if (!unknownIp(ip))
			return ip;

		ip = request.getHeader("WL-Proxy-Client-IP");
		if (!unknownIp(ip))
			return ip;

		ip = request.getHeader("HTTP_CLIENT_IP");
		if (!unknownIp(ip))
			return ip;

		ip = request.getHeader("HTTP_X_FORWARDED_FOR");
		if (!unknownIp(ip))
			return ip;

		ip = request.getRemoteAddr();
		if (!unknownIp(ip))
			return ip;

		return "unknown";
	}

	public static boolean unknownIp(String ip) {
		return ip == null || ip.length() == 0 || "unknown".equalsIgnoreCase(ip);
	}

	public static HashMap<String, Integer> getUniqueIpHits() {
		return uniqueIpHits;
	}

	/*
	 * Secure path check requires a non-anonymous user to be on this session and also already
	 * authenticated
	 */
	private void checkApiSecurity(String bearer, HttpServletRequest req, SessionContext sc) {
		// otherwise require secure header
		if (bearer == null) {
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
		// todo-1: /bin is an unusual case: can be ../bin/avatar or just ../bin
		if (path.contains("/bin") || //
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
				path.endsWith("/stream") || //
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
