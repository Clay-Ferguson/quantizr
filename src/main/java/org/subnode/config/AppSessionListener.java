package org.subnode.config;

import javax.servlet.http.HttpSession;
import javax.servlet.http.HttpSessionEvent;
import javax.servlet.http.HttpSessionListener;

import org.subnode.util.LockEx;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.util.WebUtils;

import static org.subnode.util.Util.*;

/**
 * For keeping track of sessions.
 */
@Component
public class AppSessionListener implements HttpSessionListener {
	private final Logger log = LoggerFactory.getLogger(AppSessionListener.class);
	private static int sessionCounter = 0;

	@Override
	public void sessionCreated(HttpSessionEvent se) {
		HttpSession session = se.getSession();

		// Use this to test timeout behavior.
		// session.setMaxInactiveInterval(10);

		/*
		 * I'm not sure if certain parts of 'Spring API' are gonna see this LockEx and just synchronize on
		 * it using synchronize keyword and treating it just as a plain Object would be used for a lock, but
		 * for our own API use of this lock we call lockEx() and unlockEx() on this object to use its' built
		 * in ability to detect and forcably break deadlocks when they happen!
		 */
		session.setAttribute(WebUtils.SESSION_MUTEX_ATTRIBUTE, new LockEx("SESSION-LockEx:" + session.getId(), true, 180000, 1));
		sessionCounter++;
	}

	@Override
	public void sessionDestroyed(HttpSessionEvent se) {
		HttpSession session = se.getSession();
		SessionContext sc = (SessionContext) session.getAttribute(SessionContext.QSC);
		if (ok(sc)) {
			session.removeAttribute(SessionContext.QSC);
			sc.sessionTimeout();
		}
		session.removeAttribute(WebUtils.SESSION_MUTEX_ATTRIBUTE);
		sessionCounter--;
		// log.debug("Session Destroyed: " + se.getSession().getId());
	}

	public static int getSessionCounter() {
		return sessionCounter;
	}
}
