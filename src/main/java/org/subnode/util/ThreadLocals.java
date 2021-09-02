package org.subnode.util;

import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.subnode.config.SessionContext;
import org.subnode.response.base.ResponseBase;

/**
 * Thread Local Storage
 * 
 * All thread locals are stored in this class.
 * 
 * Note: We opt for ThreadLocals instead of a Spring Bean with Request scope, so that we can
 * decouple from Web Requests, and have these variables available on a *any* thread even if it's a
 * worker or deamon thread that isn't an actual Web Request.
 */
public class ThreadLocals {
	private static final Logger log = LoggerFactory.getLogger(ThreadLocal.class);

	private static final ThreadLocal<HttpServletResponse> servletResponse = new ThreadLocal<>();
	private static final ThreadLocal<HttpSession> httpSession = new ThreadLocal<>();
	private static final ThreadLocal<SessionContext> sessionContext = new ThreadLocal<>();
	private static final ThreadLocal<ResponseBase> response = new ThreadLocal<>();
	private static final ThreadLocal<Long> stopwatchTime = new ThreadLocal<>();

	public static void removeAll() {
		httpSession.remove();
		sessionContext.remove();
		servletResponse.remove();
		response.remove();
		stopwatchTime.remove();
	}

	public static ThreadLocalsContext getContext() {
		// log.debug("getting context from thread: " + Thread.currentThread().getName());
		ThreadLocalsContext ctx = new ThreadLocalsContext();
		ctx.threadId = Thread.currentThread().getId();
		ctx.httpSession = getHttpSession();
		ctx.servletResponse = getServletResponse();
		ctx.sessionContext = getSC();
		ctx.response = getResponse();
		return ctx;
	}

	public static void setContext(ThreadLocalsContext ctx) {
		// log.debug("setting context into thread: " + Thread.currentThread().getName());
		setHttpSession(ctx.httpSession);
		setServletResponse(ctx.servletResponse);
		setSC(ctx.sessionContext);
		setResponse(ctx.response);
	}

	public static void setHttpSession(HttpSession session) {
		httpSession.set(session);
	}

	public static HttpSession getHttpSession() {
		return httpSession.get();
	}

	public static void setSC(SessionContext sc) {
		sessionContext.set(sc);
	}

	public static SessionContext getSC() {
		return sessionContext.get();
	}

	public static void setServletResponse(HttpServletResponse res) {
		servletResponse.set(res);
	}

	public static HttpServletResponse getServletResponse() {
		return servletResponse.get();
	}

	public static void setResponse(ResponseBase res) {
		response.set(res);
	}

	public static ResponseBase getResponse() {
		return response.get();
	}

	public static void setStopwatchTime(Long val) {
		stopwatchTime.set(val);
	}

	public static Long getStopwatchTime() {
		if (stopwatchTime.get() == null)
			return -1L;
		return stopwatchTime.get();
	}
}
