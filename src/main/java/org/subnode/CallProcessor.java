package org.subnode;

import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;

import org.subnode.model.client.PrincipalName;
import org.subnode.concurrency.LockEx;
import org.subnode.config.SessionContext;
import org.subnode.config.SpringContextUtil;
import org.subnode.exception.NotLoggedInException;
import org.subnode.model.UserPreferences;
import org.subnode.mongo.MongoApi;
import org.subnode.mongo.MongoSession;
import org.subnode.request.AnonPageLoadRequest;
import org.subnode.request.ChangePasswordRequest;
import org.subnode.request.LoginRequest;
import org.subnode.request.ResetPasswordRequest;
import org.subnode.request.SignupRequest;
import org.subnode.request.base.RequestBase;
import org.subnode.response.LoginResponse;
import org.subnode.response.base.ResponseBase;
import org.subnode.util.ExUtil;
import org.subnode.util.MongoRunnableEx;
import org.subnode.util.ThreadLocals;
import org.subnode.util.XString;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.util.WebUtils;

@Component
public class CallProcessor {
	private static final Logger log = LoggerFactory.getLogger(CallProcessor.class);

	@Autowired
	private MongoApi api;

	private static final boolean logRequests = true;
	// private static int mutexCounter = 0;

	// Most but not all of the time this return value is ResponseBase type, or
	// derived from that.
	public Object run(String command, RequestBase req, HttpSession httpSession, MongoRunnableEx runner) {
		ThreadLocals.setHttpSession(httpSession);
		logRequest(command, req, httpSession);

		
		/* Instantiating this, runs its constructor and ensures our threadlocal at least has an object, but most (not all) implenentations of methods end up instantiating
		their own which overwrites this */
		new ResponseBase();

		if (AppServer.isShuttingDown()) {
			throw ExUtil.wrapEx("Server is shutting down.");
		}

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

			/*
			 * If no Session originally existed AND this was not a login request, then we
			 * throw the error, that the client will pickup and use to refresh the page, as
			 * a new login. This is what happens when the session times out and then after
			 * that some RPC call is attempted.
			 */
			if (!(req instanceof LoginRequest) && //
					!(req instanceof AnonPageLoadRequest) && //
					!(req instanceof SignupRequest) && //
					!(req instanceof ResetPasswordRequest) && //
					!(req instanceof ChangePasswordRequest) && //
					!ThreadLocals.getInitialSessionExisted()) {
				log.debug(
						"Ignoring attempt to process req class " + req.getClass().getName() + " when not logged in .");
				throw new NotLoggedInException();
			}

			mongoSession = login(req, sessionContext);
			ThreadLocals.setMongoSession(mongoSession);

			if (mongoSession == null || mongoSession.getUser() == null) {
				if (!(req instanceof ChangePasswordRequest)) {
					throw new NotLoggedInException();
				}
			}

			ret = runner.run(mongoSession);
			api.saveSession(mongoSession);

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

			/* cleanup this thread, servers reuse threads */
			ThreadLocals.setMongoSession(null);
			ThreadLocals.setResponse(null);

			if (sessionContext != null) {
				if (sessionContext.getHttpSessionToInvalidate() != null) {
					sessionContext.getHttpSessionToInvalidate().invalidate();
					sessionContext.setHttpSessionToInvalidate(null);
				}
			}
		}

		logResponse(ret);
		return ret;
	}

	/* Creates a logged in session for any method call */
	private MongoSession login(RequestBase req, SessionContext sessionContext) {

		String userName = PrincipalName.ANON.s();
		String password = PrincipalName.ANON.s();

		LoginResponse res = null;
		if (req instanceof LoginRequest) {
			res = new LoginResponse();
			res.setUserPreferences(new UserPreferences());
			ThreadLocals.setResponse(res);

			LoginRequest loginRequest = (LoginRequest) req;
			userName = loginRequest.getUserName();
			password = loginRequest.getPassword();

			if (userName.equals("")) {
				userName = sessionContext.getUserName();
				password = sessionContext.getPassword();
			}

			/* not logged in and page load is checking for logged in session */
			if (userName == null) {
				return null;
			}
		} else if (req instanceof ChangePasswordRequest && ((ChangePasswordRequest) req).getPassCode() != null) {
			/*
			 * we will have no session for user here, return null;
			 */
			return null;
		} else if (req instanceof SignupRequest) {
			// allow to proceed as 'anon'
		} else {
			userName = sessionContext.getUserName();
			password = sessionContext.getPassword();

			if (userName == null) {
				userName = PrincipalName.ANON.s();
			}
			if (password == null) {
				password = PrincipalName.ANON.s();
			}
		}

		try {
			MongoSession session = api.login(userName, password);
			return session;
		} catch (Exception e) {
			if (res != null) {
				res.setSuccess(false);
				res.setMessage("Wrong username/password.");
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
