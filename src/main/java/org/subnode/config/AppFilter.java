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
 * This is Web Filter to measure basic application statistics (number of users, etc)
 */
@Component
@Order(2)
public class AppFilter extends GenericFilterBean {
	private static final Logger log = LoggerFactory.getLogger(AppFilter.class);
	private static final HashMap<String, Integer> uniqueIpHits = new HashMap<>();
	private static int reqId = 0;
	private static boolean logRequests = false;
	private static boolean logResponses = false;
	private static final String QSC = "QSC";
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

		boolean isAjaxCall = false;
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
				httpRes = (HttpServletResponse) res;
				isAjaxCall = httpReq.getRequestURI().contains("/mobile/api/");
				boolean isPublicResource = httpReq.getRequestURI().contains("/public/");

				// if not accessing some kind of public resource then create a session (and SessionContext)
				if (!isPublicResource) {
					session = httpReq.getSession(false);
					if (session == null) {
						log.trace("******** NO SESSION.");
					} else {
						log.trace("******** SESSION existed: lastAccessed: "
								+ ((System.currentTimeMillis() - session.getLastAccessedTime()) / 1000) + "secs ago.");
					}

					if (session == null) {
						session = httpReq.getSession(true);
					}

					// Ensure we have a Quanta Session Context
					SessionContext sc = (SessionContext) session.getAttribute(QSC);

					// if we don't have a SessionContext yet or it timed out then create a new one.
					if (sc == null || !sc.isLive()) {
						// Note: we create SessionContext objects here on some requests that don't need them, but that's ok
						// becasue all our code makes the assumption there will be a SessionContext on the thread.
						// log.debug("Creating new session at req "+httpReq.getRequestURI());
						sc = (SessionContext) SpringContextUtil.getBean(SessionContext.class);
						session.setAttribute(QSC, sc);
					}
					ThreadLocals.setSC(sc);

					sc.addAction(httpReq.getRequestURI());
					String bearer = httpReq.getHeader("Bearer");

					// if auth token is privided and doesn't exist that's a timed out session so send user
					// back to welcome page. Should also blow away all browser memory. New browser page load.
					if (!StringUtils.isEmpty(bearer) && !SessionContext.validToken(bearer, null)) {
						// just ignore an invalid token like it was not there.
						// log.debug("Ignoring obsolete bearer token.");
						bearer = null;
						sc.setUserName(PrincipalName.ANON.s());

						// this redirect would only apply to an HTML page request, but we have a lot of REST/ajax where
						// this redirect would not make sense.
						// log.debug("Bad or timed out token. Redirecting to land page.");
						// ((HttpServletResponse)res).sendRedirect("/app");
						// return;
					}

					// if no bearer is given, and no userName is set, then set to ANON
					if (bearer == null && sc.getUserName() == null) {
						sc.setUserName(PrincipalName.ANON.s());
					}

					if (isSecurePath(httpReq.getRequestURI())) {
						checkApiSecurity(bearer, httpReq, sc);
					}

					ip = getClientIpAddr(httpReq);
					sc.setIp(ip);
					ThreadLocals.setHttpSession(session);
				}

				if (isCrossOriginPath(httpReq.getRequestURI())) {
					httpRes.setHeader("Access-Control-Allow-Origin", "*");
				}
				String queryString = httpReq.getQueryString();

				if (simulateSlowServer > 0 && httpReq.getRequestURI().contains("/mobile/api/")) {
					Util.sleep(simulateSlowServer);
				}
				setCachingHeader(httpReq, httpRes);

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
			if (isAjaxCall) {
				httpRes.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
				return;
			}
			throw e;
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

		if (httpReq.getRequestURI().contains("/mobile/api/")) {
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
	}

	private void setCachingHeader(HttpServletRequest req, HttpServletResponse res) {
		/*
		 * Yeah I know this is a hacky way to set Cache-Control, and there's a more elegant way to do this
		 * with spring
		 */
		// Example: The better way (not yet done)
		// @Configuration
		// public class MvcConfigurer extends WebMvcConfigurerAdapter
		// implements EmbeddedServletContainerCustomizer {
		// @Override
		// public void addResourceHandlers(ResourceHandlerRegistry registry) {
		// // Resources without Spring Security. No cache control response headers.
		// registry.addResourceHandler("/static/public/**")
		// .addResourceLocations("classpath:/static/public/");
		if (req.getRequestURI().contains("/images/") || //
				req.getRequestURI().contains("/fonts/") || //
				req.getRequestURI().endsWith("/bundle.js") || //
				req.getRequestURI().endsWith("/favicon.ico") || //

				// This is the tricky one. If we have versioned the URL we detect it this hacky way also picking up
				// v param.
				req.getRequestURI().contains("?v=")) {
			res.setHeader("Cache-Control", "public, must-revalidate, max-age=31536000");
		}
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

	private boolean isCrossOriginPath(String path) {
		return (path.contains("/.well-known/") || //
				path.contains("/ap/"));
	}

	// todo-1: app is too fragile if you forget to add one here. fix this.
	private boolean isSecurePath(String path) {
		if (path.contains("/mobile/api/login") || //
				path.contains("/mobile/api/signup") || //
				path.contains("/mobile/api/savePublicKey") || //
				path.contains("/mobile/api/changePassword") || //
				path.contains("/mobile/api/getConfig") || //
				path.contains("/mobile/api/serverPush") || //
				path.contains("/mobile/api/renderNode") || //
				path.contains("/mobile/api/getNodeMetaInfo") || //
				path.contains("/mobile/api/bin") || //
				path.contains("/mobile/api/captcha") || //
				path.contains("/mobile/api/getUserProfile") || //
				path.contains("/mobile/api/nodeFeed") || //
				path.contains("/mobile/api/getFollowers") || //
				path.contains("/mobile/api/getFollowing") || //
				path.contains("/mobile/api/nodeSearch") || //
				path.contains("/mobile/api/graphNodes") || //
				path.contains("/mobile/api/resetPassword") || //
				path.contains("/mobile/api/stream") || //
				path.contains("/mobile/api/getNodeStats") || //
				path.contains("/mobile/api/getUserAccountInfo") || //
				path.contains("/mobile/api/anonPageLoad") || //
				path.contains("/mobile/api/getOpenGraph") || //
				path.contains("/mobile/api/getMultiRssFeed")) {
			return false;
		}
		return path.contains("/mobile/api/");
	}
}
