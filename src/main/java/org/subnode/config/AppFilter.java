package org.subnode.config;

import java.io.IOException;
import java.util.HashMap;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.GenericFilterBean;
import org.subnode.mongo.MongoThreadLocal;
import org.subnode.util.ThreadLocals;
import org.subnode.util.Util;
import org.subnode.util.XString;

/**
 * This is Web Filter to measure basic application statistics (number of users, etc)
 */
@Component
public class AppFilter extends GenericFilterBean {
	private static final Logger log = LoggerFactory.getLogger(AppFilter.class);
	private static final HashMap<String, Integer> uniqueIpHits = new HashMap<>();
	private static int reqId = 0;
	private static boolean logRequests = false;
	private static boolean logResponses = false;

	@Autowired
	private SessionContext sessionContext;

	/*
	 * if non-zero this is used to put a millisecond delay (determined by its value) onto every request
	 * that comes thru as an API call.
	 */
	private static int simulateSlowServer = 0;

	/*
	 * For debugging we can turn this flag on and disable the server from processing multiple requests
	 * simultenaously this is every helpful for debugging
	 */
	private static boolean singleThreadDebugging = false;
	private static final HashMap<String, Object> locksByIp = new HashMap<>();

	@Override
	public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain) throws IOException, ServletException {
		try {
			int thisReqId = ++reqId;
			String ip = null;

			if (req instanceof HttpServletRequest) {
				HttpServletRequest httpReq = (HttpServletRequest) req;
				HttpServletResponse httpRes = (HttpServletResponse) res;
				ip = getClientIpAddr(httpReq);

				HttpSession session = httpReq.getSession(false);
				if (session == null) {
					log.trace("******** NO SESSION.");
				} else {
					log.trace("******** SESSION existed: lastAccessed: "
							+ ((System.currentTimeMillis() - session.getLastAccessedTime()) / 1000) + "secs ago.");
				}

				if (session == null) {
					session = httpReq.getSession(true);
				}
				ThreadLocals.setHttpSession(session);
				ThreadLocals.setSessionContext(sessionContext);
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
				/*
				 * singleThreadDebugging creates one lock per IP so that each machine calling our server gets single
				 * threaded, but other servers can call in parallel
				 */
				if (singleThreadDebugging) {
					if (ip == null) {
						ip = "unknown";
					}

					Object lock = locksByIp.get(ip);
					if (lock == null) {
						lock = new Object();
						locksByIp.put(ip, lock);
					}

					synchronized (lock) {
						chain.doFilter(req, res);
					}
				} else {
					chain.doFilter(req, res);
				}

				if (logResponses) {
					HttpServletResponse httpRes = (HttpServletResponse) res;
					log.debug("    RES: [" + String.valueOf(thisReqId) + "]" /* +httpRes.getStatus() */
							+ HttpStatus.valueOf(httpRes.getStatus()));
				}

			} catch (RuntimeException ex) {
				log.error("Request Failed", ex);
				throw ex;
			}
		}
		finally {
			/* Set thread back to clean slate, for it's next cycle time in threadpool */
			ThreadLocals.removeAll();
			MongoThreadLocal.removeAll();
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
			((HttpServletResponse) res).setHeader("Cache-Control", "public, must-revalidate, max-age=31536000");
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
}
