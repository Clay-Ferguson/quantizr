package org.subnode.config;

import javax.servlet.http.HttpSession;
import javax.servlet.http.HttpSessionEvent;
import javax.servlet.http.HttpSessionListener;

import org.subnode.concurrency.LockEx;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.util.WebUtils;

/**
 * Class for keeping track of number of sessions.
 */
@Component
public class AppSessionListener implements HttpSessionListener {
	private static int sessionCounter = 0;
	private final Logger log = LoggerFactory.getLogger(AppSessionListener.class);

	@Override
	public void sessionCreated(HttpSessionEvent se) {
		HttpSession session = se.getSession();

		// Use this to test timeout behavior.
		// session.setMaxInactiveInterval(10);

		/*
		 * I'm not sure if certain parts of 'Spring API' are gonna see this LockEx and
		 * just synchronize on it using synchronize keyword and treating it just as a
		 * plain Object would be used for a lock, but for our own API use of this lock
		 * we call lockEx() and unlockEx() on this object to use its' built in ability
		 * to detect and forcably break deadlocks when they happen!
		 */
		session.setAttribute(WebUtils.SESSION_MUTEX_ATTRIBUTE,
				new LockEx("SESSION-LockEx:" + session.getId(), true, 180000, 1));
		sessionCounter++;
		log.debug("Session/Lock Created");
	}

	@Override
	public void sessionDestroyed(HttpSessionEvent se) {
		se.getSession().removeAttribute(WebUtils.SESSION_MUTEX_ATTRIBUTE);
		sessionCounter--;
		log.debug("Session Destroyed: "+se.getSession().getId());
	}

	public static int getSessionCounter() {
		return sessionCounter;
	}
}
