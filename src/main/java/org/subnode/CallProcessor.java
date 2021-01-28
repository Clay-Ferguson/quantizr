package org.subnode;

import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.util.WebUtils;
import org.subnode.config.SessionContext;
import org.subnode.config.SpringContextUtil;
import org.subnode.exception.NotLoggedInException;
import org.subnode.model.UserPreferences;
import org.subnode.model.client.PrincipalName;
import org.subnode.mongo.MongoAuth;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.MongoUpdate;
import org.subnode.request.ChangePasswordRequest;
import org.subnode.request.LoginRequest;
import org.subnode.request.base.RequestBase;
import org.subnode.response.LoginResponse;
import org.subnode.response.base.ResponseBase;
import org.subnode.service.UserManagerService;
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

	@Autowired
	private MongoAuth auth;

	@Autowired
	private UserManagerService userManagerService;

	private static final boolean logRequests = true;
	// private static int mutexCounter = 0;

	// Most (but not all) of the time this return value is ResponseBase type, or
	// derived from that.
	public Object run(String command, RequestBase req, HttpSession httpSession, MongoRunnableEx runner) {
		if (AppServer.isShuttingDown()) {
			throw ExUtil.wrapEx("Server is shutting down.");
		}

		ThreadLocals.setHttpSession(httpSession);
		logRequest(command, req, httpSession);

		/*
		 * Instantiating this, runs its constructor and ensures our threadlocal at least has respons object
		 * on it, but most (not all) implenentations of methods end up instantiating their own which
		 * overwrites this
		 */
		new ResponseBase();

		Object ret = null;
		MongoSession mongoSession = null;
		SessionContext sessionContext = (SessionContext) SpringContextUtil.getBean(SessionContext.class);

		LockEx mutex = (LockEx) WebUtils.getSessionMutex(ThreadLocals.getHttpSession());
		if (mutex == null) {
			log.error("Session mutex lock is null.");
		}

		try {
			if (mutex != null) {
				mutex.lockEx();
			}
			// mutexCounter++;
			// log.debug("Enter: mutexCounter: "+String.valueOf(mutexCounter));

			mongoSession = login(req, sessionContext);
			ThreadLocals.setMongoSession(mongoSession);

			if (mongoSession == null || mongoSession.getUser() == null) {
				if (!(req instanceof ChangePasswordRequest)) {
					throw new NotLoggedInException();
				}
			}

			ret = runner.run(mongoSession);
			update.saveSession(mongoSession);

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
				orb.setExceptionClass(e.getClass().getName());

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
			if (mutex != null) {
				mutex.unlockEx();
			}
			// mutexCounter--;
			// log.debug("Exit: mutexCounter: "+String.valueOf(mutexCounter));

			try {
				/* cleanup this thread, servers reuse threads */
				ThreadLocals.setMongoSession(null);
				ThreadLocals.setResponse(null);
				if (sessionContext != null) {
					sessionContext.maybeInvalidate();
				}
			} catch (Exception e) {
				ExUtil.error(log, "exception in call processor finally block. ignoring.", e);
			}
		}

		logResponse(ret);
		return ret;
	}

	/* Creates a logged in session for any method call */
	private MongoSession login(RequestBase req, SessionContext sessionContext) {

		// default to anonymous user
		String userName = req == null || StringUtils.isEmpty(req.getUserName()) ? PrincipalName.ANON.s() : req.getUserName();
		String password = req == null || StringUtils.isEmpty(req.getPassword()) ? PrincipalName.ANON.s() : req.getPassword();

		LoginResponse res = null;
		if (req instanceof LoginRequest) {
			res = new LoginResponse();
			res.setUserPreferences(new UserPreferences());
			ThreadLocals.setResponse(res);

			userName = req.getUserName();
			password = req.getPassword();
		} else {
			// If the session already contains user and pwd use those creds
			if (sessionContext.getUserName() != null && sessionContext.getPassword() != null) {
				userName = sessionContext.getUserName();
				password = sessionContext.getPassword();
			}
		}

		try {
			/* in this auth.login we check credentials and throw exception if invalid */
			MongoSession session = auth.login(userName, password);
			sessionContext.setUserName(userName);
			sessionContext.setPassword(password);

			if (req instanceof LoginRequest) {
				sessionContext.init(req);
				userManagerService.processLogin(session, null, req.getUserName());
			}
			return session;
		} catch (Exception e) {
			if (res != null) {
				res.setSuccess(false);
				res.setMessage("Unauthorized.");
			}
			throw ExUtil.wrapEx(e);
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
