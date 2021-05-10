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
import org.subnode.exception.NotLoggedInException;
import org.subnode.exception.OutOfSpaceException;
import org.subnode.model.UserPreferences;
import org.subnode.model.client.ErrorType;
import org.subnode.model.client.PrincipalName;
import org.subnode.mongo.MongoAuth;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.MongoUpdate;
import org.subnode.request.ChangePasswordRequest;
import org.subnode.request.LoginRequest;
import org.subnode.request.LogoutRequest;
import org.subnode.request.base.RequestBase;
import org.subnode.response.LoginResponse;
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

	@Autowired
	private MongoAuth auth;

	private static final boolean logRequests = true;
	// private static int mutexCounter = 0;

	/*
	 * Wraps the processing of any command by using whatever info is on the session
	 * and/or the request to perform the login if the user is not logged in, and
	 * then call the function to be processed
	 */
	public Object run(String command, RequestBase req, HttpSession httpSession, MongoRunnableEx<Object> runner) {
		if (AppServer.isShuttingDown()) {
			throw ExUtil.wrapEx("Server not available.");
		}

		ThreadLocals.setHttpSession(httpSession);
		logRequest(command, req, httpSession);

		/*
		 * Instantiating this, runs its constructor and ensures our threadlocal at least
		 * has respons object on it, but most (not all) implenentations of methods end
		 * up instantiating their own which overwrites this
		 */
		new ResponseBase();

		Object ret = null;
		MongoSession mongoSession = null;
		LockEx mutex = (LockEx) WebUtils.getSessionMutex(ThreadLocals.getHttpSession());
		if (mutex == null) {
			log.error("Session mutex lock is null.");
		}

		try {
			if (mutex != null) {
				mutex.lockEx();
			}

			if (req instanceof LogoutRequest) {
				// Note: all this run will be doing in this case is a session invalidate.
				ret = runner.run(null);
			} else {
				// mutexCounter++;
				// log.debug("Enter: mutexCounter: "+String.valueOf(mutexCounter));

				mongoSession = processCredentialsAndGetSession(req);
				ThreadLocals.setMongoSession(mongoSession);

				if (mongoSession == null || mongoSession.getUserName() == null) {
					if (!(req instanceof ChangePasswordRequest)) {
						throw new NotLoggedInException();
					}
				}

				ret = runner.run(mongoSession);
				update.saveSession(mongoSession);
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
			if (mutex != null) {
				mutex.unlockEx();
			}
			// mutexCounter--;
			// log.debug("Exit: mutexCounter: "+String.valueOf(mutexCounter));

			/* cleanup this thread, servers reuse threads */
			ThreadLocals.setMongoSession(null);
			ThreadLocals.setResponse(null);
		}

		logResponse(ret);
		return ret;
	}

	private void setErrorType(ResponseBase res, Exception ex) {
		if (ex instanceof OutOfSpaceException) {
			res.setErrorType(ErrorType.OUT_OF_SPACE);
		}
	}

	/* Creates a logged in session for any method call */
	private MongoSession processCredentialsAndGetSession(RequestBase req) {

		SessionContext sc = ThreadLocals.getSessionContext();
		String userName = null;
		String password = null;

		LoginResponse res = null;
		if (req instanceof LoginRequest) {
			res = new LoginResponse();
			res.setUserPreferences(new UserPreferences());

			userName = req.getUserName();
			password = req.getPassword();
		} else {
			// If the session already contains user and pwd use those creds
			if (sc.getUserName() != null && sc.getPassword() != null) {
				userName = sc.getUserName();
				password = sc.getPassword();
			}
			// Otherwise take the creds off the 'req' if existing, or use 'anon' for both if
			// not.
			else {
				userName = req == null || StringUtils.isEmpty(req.getUserName()) ? PrincipalName.ANON.s()
						: req.getUserName();
				password = req == null || StringUtils.isEmpty(req.getPassword()) ? PrincipalName.ANON.s()
						: req.getPassword();
			}
		}

		try {
			/* in this auth.login we check credentials and throw exception if invalid */
			MongoSession session = auth.processCredentials(userName, password, req);
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
