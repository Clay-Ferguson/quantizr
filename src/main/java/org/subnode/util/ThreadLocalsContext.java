package org.subnode.util;

import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.subnode.config.SessionContext;
import org.subnode.response.base.ResponseBase;

/**
 * Holder for transferring ThreadLocals values from one thread to another.
 */
public class ThreadLocalsContext {
	private static final Logger log = LoggerFactory.getLogger(ThreadLocalsContext.class);

	public long threadId;
	public HttpServletResponse servletResponse;
	public HttpSession httpSession;
	public SessionContext sessionContext;
	public ResponseBase response;
}
