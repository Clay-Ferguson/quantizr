package org.subnode;

import java.util.Date;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.util.WebUtils;
import org.subnode.exception.NotLoggedInException;
import org.subnode.exception.OutOfSpaceException;
import org.subnode.model.client.ErrorType;
import org.subnode.mongo.MongoSession;

import org.subnode.mongo.MongoUpdate;
import org.subnode.request.LogoutRequest;
import org.subnode.request.base.RequestBase;
import org.subnode.response.base.ResponseBase;
import org.subnode.util.ExUtil;
import org.subnode.util.LockEx;
import org.subnode.util.MongoRunnableEx;
import org.subnode.util.ThreadLocals;
import org.subnode.util.XString;

@Component
public class CallProcessor {
	private static final Logger log = LoggerFactory.getLogger(CallProcessor.class);

	@Autowired
	private MongoUpdate update;

	private static final boolean logRequests = true;
	// private static int mutexCounter = 0;

	/*
	 * Wraps the processing of any command by using whatever info is on the session and/or the request
	 * to perform the login if the user is not logged in, and then call the function to be processed
	 */
	public Object run(String command, RequestBase req, HttpSession httpSession, MongoRunnableEx<Object> runner) {
		if (AppServer.isShuttingDown()) {
			throw ExUtil.wrapEx("Server not available.");
		}

		ThreadLocals.setHttpSession(httpSession);
		logRequest(command, req, httpSession);

		/*
		 * Instantiating this, runs its constructor and ensures our threadlocal at least has response object
		 * on it, but most (not all) implenentations of methods end up instantiating their own which
		 * overwrites this
		 */
		new ResponseBase();

		Object ret = null;
		LockEx mutex = (LockEx) WebUtils.getSessionMutex(ThreadLocals.getHttpSession());
		if (mutex == null) {
			log.error("Session mutex lock is null.");
		}

		try {
			ThreadLocals.getSC().stopwatch("> " + command);
			if (mutex != null) {
				mutex.lockEx();
			}

			if (req instanceof LogoutRequest) {
				// Note: all this run will be doing in this case is a session invalidate.
				ret = runner.run(null);
			} else {
				// mutexCounter++;
				// log.debug("Enter: mutexCounter: "+String.valueOf(mutexCounter));
				Date now = new Date();
				ThreadLocals.getSC().setLastActiveTime(now.getTime());
				MongoSession ms = ThreadLocals.getMongoSession();
				ret = runner.run(ms);
				update.saveSession(ms);
			}

		} catch (NotLoggedInException e1) {
			HttpServletResponse res = ThreadLocals.getServletResponse();
			try {
				if (res != null) {
					log.debug("Unauthorized. Not logged in.");
					res.sendError(HttpServletResponse.SC_UNAUTHORIZED);
				}
			} catch (Exception e) {
				ExUtil.error(log, "exception in call processor", e);
			}
		} catch (Exception e) {
			ExUtil.error(log, "exception in call processor", e);
			ret = ThreadLocals.getResponse();

			if (ret instanceof ResponseBase) {
				ResponseBase orb = (ResponseBase) ret;
				orb.setSuccess(false);
				setErrorType(orb, e);

				/* only set a message if one is not already set */
				if (StringUtils.isEmpty(orb.getMessage())) {
					/*
					 * for now, we can just send back the actual exception message
					 */
					if (e.getMessage() != null) {
						orb.setMessage("Request Failed: " + e.getMessage());
					} else {
						orb.setMessage("Request Failed.");
					}
				}

				orb.setStackTrace(ExceptionUtils.getStackTrace(e));
			}
		} finally {
			ThreadLocals.getSC().stopwatch("< " + command);
			if (mutex != null) {
				mutex.unlockEx();
			}
			// mutexCounter--;
			// log.debug("Exit: mutexCounter: "+String.valueOf(mutexCounter));
			ThreadLocals.removeAll();
		}

		logResponse(ret);
		return ret;
	}

	private void setErrorType(ResponseBase res, Exception ex) {
		if (ex instanceof OutOfSpaceException) {
			res.setErrorType(ErrorType.OUT_OF_SPACE.s());
		}
	}

	private static void logRequest(String url, Object req, HttpSession httpSession) {
		if (logRequests) {
			log.trace("REQ=" + url + " " + (req == null ? "none" : XString.prettyPrint(req)));
		}
	}

	private static void logResponse(Object res) {
		if (logRequests) {
			log.trace("RES=" + (res == null ? "none" : XString.prettyPrint(res)));
		}
	}
}
