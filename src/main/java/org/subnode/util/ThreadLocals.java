package org.subnode.util;

import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
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
	private static final ThreadLocal<HttpServletResponse> servletResponse = new ThreadLocal<>();
	private static final ThreadLocal<HttpSession> httpSession = new ThreadLocal<>();
	private static final ThreadLocal<SessionContext> sessionContext = new ThreadLocal<>();
	private static final ThreadLocal<ResponseBase> response = new ThreadLocal<>();

	public static void removeAll() {
		httpSession.remove();
		sessionContext.remove();
		servletResponse.remove();
		response.remove();
	}

	public static void setHttpSession(HttpSession session) {
		httpSession.set(session);
	}

	public static HttpSession getHttpSession() {
		return httpSession.get();
	}

	public static void setSessionContext(SessionContext sc) {
		sessionContext.set(sc);
	}

	public static SessionContext getSessionContext() {
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
}
