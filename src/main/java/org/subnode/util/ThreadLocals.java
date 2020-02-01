package org.subnode.util;

import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;

import org.subnode.mongo.MongoSession;
import org.subnode.response.base.ResponseBase;

/**
 * Thread Local Storage
 * 
 * All thread locals are stored in this class.
 * 
 * Note: We opt for ThreadLocals instead of a Spring Bean with Request scope, so
 * that we can decouple from Web Requests, and have these variables available on
 * a *any* thread even if it's a worker or deamon thread that isn't an actual
 * Web Request. I never use "Request Scoping" unless the object being scoped as
 * request is specifically and solely something that exists only in an actual
 * web request.
 */
public class ThreadLocals {
	private static final ThreadLocal<HttpServletResponse> servletResponse = new ThreadLocal<HttpServletResponse>();
	private static final ThreadLocal<HttpSession> httpSession = new ThreadLocal<HttpSession>();
	private static final ThreadLocal<Boolean> initialSessionExisted = new ThreadLocal<Boolean>();
	private static final ThreadLocal<MongoSession> mongoSession = new ThreadLocal<MongoSession>();
	private static final ThreadLocal<ResponseBase> oakResponse = new ThreadLocal<ResponseBase>();

	public static void removeAll() {
		httpSession.remove();
		servletResponse.remove();
		initialSessionExisted.remove();
		oakResponse.remove();
		mongoSession.remove();
	}

	public static void setHttpSession(HttpSession session) {
		httpSession.set(session);
	}

	public static HttpSession getHttpSession() {
		return httpSession.get();
	}

	public static void setServletResponse(HttpServletResponse res) {
		servletResponse.set(res);
	}

	public static HttpServletResponse getServletResponse() {
		return servletResponse.get();
	}

	public static void setMongoSession(MongoSession session) {
		mongoSession.set(session);
	}

	public static MongoSession getMongoSession() {
		return mongoSession.get();
	}

	public static void setResponse(ResponseBase response) {
		oakResponse.set(response);
	}

	public static ResponseBase getResponse() {
		return oakResponse.get();
	}

	public static void setInitialSessionExisted(Boolean val) {
		initialSessionExisted.set(val);
	}

	public static Boolean getInitialSessionExisted() {
		return initialSessionExisted.get();
	}
}
