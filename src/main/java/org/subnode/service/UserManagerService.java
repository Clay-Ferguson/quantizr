package org.subnode.service;

import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Random;

import org.subnode.config.AppProp;
import org.subnode.config.ConstantsProvider;
import org.subnode.model.client.PrincipalName;
import org.subnode.model.client.NodeProp;
import org.subnode.config.SessionContext;
import org.subnode.mail.OutboxMgr;
import org.subnode.model.UserPreferences;
import org.subnode.model.UserStats;
import org.subnode.mongo.AclService;
import org.subnode.mongo.MongoApi;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.RunAsMongoAdmin;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.ChangePasswordRequest;
import org.subnode.request.CloseAccountRequest;
import org.subnode.request.LoginRequest;
import org.subnode.request.ResetPasswordRequest;
import org.subnode.request.SavePublicKeyRequest;
import org.subnode.request.SaveUserPreferencesRequest;
import org.subnode.request.SignupRequest;
import org.subnode.response.ChangePasswordResponse;
import org.subnode.response.CloseAccountResponse;
import org.subnode.response.LoginResponse;
import org.subnode.response.ResetPasswordResponse;
import org.subnode.response.SavePublicKeyResponse;
import org.subnode.response.SaveUserPreferencesResponse;
import org.subnode.response.SignupResponse;
import org.subnode.util.DateUtil;
import org.subnode.util.ExUtil;
import org.subnode.util.ThreadLocals;
import org.subnode.util.ValContainer;
import org.subnode.util.Validator;
import org.subnode.util.XString;

import org.apache.commons.lang3.StringUtils;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.ui.Model;

/**
 * Service methods for processing user management functions. Login, logout,
 * signup, user preferences, and settings persisted per-user
 */
@Component
public class UserManagerService {
	private static final Logger log = LoggerFactory.getLogger(UserManagerService.class);

	private static final Random rand = new Random();

	@Autowired
	private MongoApi api;

	@Autowired
	private AppProp appProp;

	@Autowired
	private SessionContext sessionContext;

	@Autowired
	private OutboxMgr outboxMgr;

	@Autowired
	private RunAsMongoAdmin adminRunner;

	@Autowired
	private ConstantsProvider constProvider;

	@Autowired
	private AclService acu;

	@Autowired
	private Validator validator;

	/*
	 * Login mechanism is a bit tricky because the CallProcessor detects the
	 * LoginRequest and performs authentication BEFORE this 'login' method even gets
	 * called, so by the time we are in this method we can safely assume the
	 * userName and password resulted in a successful login.
	 */
	public LoginResponse login(MongoSession session, LoginRequest req) {
		LoginResponse res = new LoginResponse();
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}

		String userName = req.getUserName();
		String password = req.getPassword();
		log.debug("login: user=" + userName);

		/*
		 * We have to get timezone information from the user's browser, so that all
		 * times on all nodes always show up in their precise local time!
		 */
		sessionContext.setTimezone(DateUtil.getTimezoneFromOffset(req.getTzOffset()));
		sessionContext.setTimeZoneAbbrev(DateUtil.getUSTimezone(-req.getTzOffset() / 60, req.isDst()));

		if (userName.equals("")) {
			userName = sessionContext.getUserName();
		} else {
			sessionContext.setUserName(userName);
			sessionContext.setPassword(password);
		}

		if (session == null) {
			log.debug("session==null, using anonymous user");
			/*
			 * Note: This is not an error condition, this happens whenever the page loads
			 * for the first time and the user has no session yet,
			 */
			res.setUserName(PrincipalName.ANON.s());
			res.setMessage("not logged in.");
			res.setSuccess(false);
		} else {
			SubNode userNode = api.getUserNodeByUserName(session, userName);
			if (userNode == null) {
				throw new RuntimeException("User not found: " + userName);
			}

			String id = userNode.getId().toHexString();
			sessionContext.setRootId(id);
			res.setRootNode(id);
			res.setRootNodePath(userNode.getPath());
			res.setUserName(userName);
			res.setAllowFileSystemSearch(appProp.isAllowFileSystemSearch());

			UserPreferences userPreferences = getUserPreferences();
			sessionContext.setUserPreferences(userPreferences);
			res.setUserPreferences(userPreferences);
			res.setSuccess(true);
		}

		res.setAnonUserLandingPageNode(appProp.getUserLandingPageNode());
		log.debug(
				"Processing Login: urlId=" + (sessionContext.getUrlId() != null ? sessionContext.getUrlId() : "null"));

		if (sessionContext.getUrlId() != null) {
			log.debug("setHomeNodeOverride (from session urlId): " + sessionContext.getUrlId());
			res.setHomeNodeOverride(sessionContext.getUrlId());
		}

		if (res.getUserPreferences() == null) {
			res.setUserPreferences(getDefaultUserPreferences());
		}
		return res;
	}

	public CloseAccountResponse closeAccount(CloseAccountRequest req) {
		CloseAccountResponse res = new CloseAccountResponse();
		log.debug("Closing Account: " + sessionContext.getUserName());
		adminRunner.run(session -> {
			String userName = sessionContext.getUserName();

			SubNode ownerNode = api.getUserNodeByUserName(session, userName);
			if (ownerNode != null) {
				api.delete(session, ownerNode);
			}
		});
		return res;
	}

	public void writeUserStats(final MongoSession session, HashMap<ObjectId, UserStats> userStats) {
		userStats.forEach((final ObjectId key, final UserStats stat) -> {
			SubNode node = api.getNode(session, key);
			if (node != null) {
				node.setProp(NodeProp.BIN_TOTAL.s(), stat.binUsage);
			} else {
				/*
				 * this case will indicate an indirectly, that there are nodes in the 'tree'
				 * that currently have no ultimate user root node (account node), so this means
				 * out orphan cleanup also needs to do the 'tree' in addition to just the
				 * 'grid'/binaries
				 * 
				 * todo-0: address this issue.
				 */
			}
		});
	}

	/*
	 * Processes last step of signup, which is validation of registration code. This
	 * means user has clicked the link they were sent during the signup email
	 * verification, and they are sending in a signupCode that will turn on their
	 * account and actually create their account.
	 */
	public void processSignupCode(final String signupCode, final Model model) {
		log.debug("User is trying signupCode: " + signupCode);
		adminRunner.run(session -> {
			SubNode node = api.getNode(session, signupCode);

			if (node != null) {
				if (!node.getBooleanProp(NodeProp.SIGNUP_PENDING.s())) {
					throw ExUtil.newEx("Signup was already completed.");
				}

				String userName = node.getStringProp(NodeProp.USER.s());

				if (PrincipalName.ADMIN.s().equalsIgnoreCase(userName)) {
					throw new RuntimeException("processSignupCode should not be called fror admin user.");
				}

				// // Currently we just store password on server in cleartext (security isn't a
				// priority yet on the platform),
				// // and we will never go back to even encrypting the password. The modern best
				// practice for this is to store
				// // a hash of the password only so that even the server itself doesn't know
				// what the actual password is.
				// // password = encryptor.decrypt(password);

				// String email = node.getStringProp(NodeProp.EMAIL);

				// I'm leaving this here commented, but it was the bug where two user nodes
				// got created!
				// initNewUser(session, userName, password, email, false);

				/*
				 * allow JavaScript to detect all it needs to detect which is to display a
				 * message to user saying the signup is complete.
				 */
				model.addAttribute("signupCode", "ok");

				node.deleteProp(NodeProp.SIGNUP_PENDING.s());
				api.save(session, node);

				sessionContext.setSignupSuccessMessage("Signup Successful. You may login now.");
			} else {
				throw ExUtil.newEx("Signup Code is invalid.");
			}
		});
	}

	public void initNewUser(MongoSession session, String userName, String password, String email, boolean automated) {
		SubNode userNode = api.createUser(session, userName, email, password, automated);
		if (userNode != null) {
			log.debug("Successful signup complete.");
		}
	}

	public List<String> getOwnerNames(SubNode node) {
		final ValContainer<List<String>> ret = new ValContainer<List<String>>();
		adminRunner.run(session -> {
			ret.setVal(acu.getOwnerNames(session, node));
		});
		return ret.getVal();
	}

	/*
	 * Processes a signup request from a user. We create the user root node in a
	 * pending state, and like all other user accounts all information specific to
	 * that user that we currently know is held in that node (i.e. preferences)
	 */
	public SignupResponse signup(SignupRequest req, boolean automated) {
		MongoSession session = api.getAdminSession();
		SignupResponse res = new SignupResponse();

		final String userName = req.getUserName().trim();
		final String password = req.getPassword().trim();
		final String email = req.getEmail();

		log.debug("Signup: userName=" + userName + " email=" + email);

		/* throw exceptions of the username or password are not valid */
		validator.checkUserName(userName);
		validator.checkPassword(password);
		validator.checkEmail(email);

		if (!automated) {
			initiateSignup(session, userName, password, email);
		} else {
			initNewUser(session, userName, password, email, automated);
		}

		res.setMessage("success: " + String.valueOf(++sessionContext.counter));
		res.setSuccess(true);
		return res;
	}

	/*
	 * Adds user to the list of pending accounts and they will stay in pending
	 * status until their signupCode has been used to validate their email address.
	 */
	public void initiateSignup(MongoSession session, String userName, String password, String email) {

		SubNode ownerNode = api.getUserNodeByUserName(session, userName);
		if (ownerNode != null) {
			throw new RuntimeException("User already exists.");
		}

		SubNode newUserNode = api.createUser(session, userName, email, password, false);

		/*
		 * It's easiest to use the actua new UserNode ID as the 'signup code' to send to
		 * the user, because it's random and tied to this user by definition
		 */
		String signupCode = newUserNode.getId().toHexString();
		String signupLink = constProvider.getHostAndPort() + "?signupCode=" + signupCode;
		String content = null;

		/*
		 * We print this out so we can use it in DEV mode when no email support may be
		 * configured
		 */
		log.debug("Signup URL: " + signupLink);

		content = "Welcome to quantizr.com: " + userName + //
				"<p>\nClick this link to complete signup: <br>\n" + signupLink;

		if (!StringUtils.isEmpty(appProp.getMailHost())) {
			outboxMgr.queueEmail(email, "quantizr.com - Account Signup", content);
		}
	}

	public void setDefaultUserPreferences(SubNode prefsNode) {
		prefsNode.setProp(NodeProp.USER_PREF_EDIT_MODE.s(), false);
	}

	public SavePublicKeyResponse savePublicKey(final SavePublicKeyRequest req) {
		SavePublicKeyResponse res = new SavePublicKeyResponse();
		final String userName = sessionContext.getUserName();

		adminRunner.run(session -> {
			SubNode userNode = api.getUserNodeByUserName(session, userName);

			if (userNode != null) {
				userNode.setProp(NodeProp.USER_PREF_PUBLIC_KEY.s(), req.getKeyJson());
			} else {
				log.debug("savePublicKey failed to find userName: " + userName);
			}
			res.setSuccess(true);

			// don't display a message unless this was a user-initiated save.
			// res.setMessage("Key Saved");
		});
		return res;
	}

	public SaveUserPreferencesResponse saveUserPreferences(final SaveUserPreferencesRequest req) {
		SaveUserPreferencesResponse res = new SaveUserPreferencesResponse();
		final String userName = sessionContext.getUserName();

		adminRunner.run(session -> {
			SubNode prefsNode = api.getUserNodeByUserName(session, userName);

			UserPreferences reqUserPrefs = req.getUserPreferences();

			/*
			 * Assign preferences as properties on this node,
			 */
			boolean editMode = reqUserPrefs.isEditMode();
			prefsNode.setProp(NodeProp.USER_PREF_EDIT_MODE.s(), editMode);

			boolean showMetaData = reqUserPrefs.isShowMetaData();
			prefsNode.setProp(NodeProp.USER_PREF_SHOW_METADATA.s(), showMetaData);

			/*
			 * Also update session-scope object, because server-side functions that need
			 * preference information will get it from there instead of loading it from
			 * repository. The only time we load user preferences from repository is during
			 * login when we can't get it from anywhere else at that time.
			 */
			UserPreferences userPreferences = sessionContext.getUserPreferences();
			userPreferences.setEditMode(editMode);
			userPreferences.setShowMetaData(showMetaData);

			res.setSuccess(true);
		});
		return res;
	}

	public UserPreferences getDefaultUserPreferences() {
		return new UserPreferences();
	}

	public UserPreferences getUserPreferences() {
		final String userName = sessionContext.getUserName();
		final UserPreferences userPrefs = new UserPreferences();

		adminRunner.run(session -> {
			SubNode prefsNode = api.getUserNodeByUserName(session, userName);
			userPrefs.setEditMode(prefsNode.getBooleanProp(NodeProp.USER_PREF_EDIT_MODE.s()));
			userPrefs.setShowMetaData(prefsNode.getBooleanProp(NodeProp.USER_PREF_SHOW_METADATA.s()));
			userPrefs.setImportAllowed(prefsNode.getBooleanProp(NodeProp.USER_PREF_IMPORT_ALLOWED.s()));
			userPrefs.setExportAllowed(prefsNode.getBooleanProp(NodeProp.USER_PREF_EXPORT_ALLOWED.s()));
		});

		return userPrefs;
	}

	/*
	 * Runs when user is doing the 'change password' or 'reset password'
	 */
	public ChangePasswordResponse changePassword(MongoSession session, final ChangePasswordRequest req) {
		ChangePasswordResponse res = new ChangePasswordResponse();
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}

		SubNode userNode[] = new SubNode[1];
		String userName[] = new String[1];

		String passCode = req.getPassCode();
		if (passCode != null) {

			/*
			 * We can run this block as admin, because the codePart below is secret and is
			 * checked for a match
			 */
			adminRunner.run(mongoSession -> {

				String userNodeId = XString.truncateAfterFirst(passCode, "-");

				if (userNodeId == null) {
					throw new RuntimeException("Unable to find userNodeId: " + userNodeId);
				}
				userNode[0] = api.getNode(mongoSession, userNodeId);

				if (userNode[0] == null) {
					throw ExUtil.newEx("Invald password reset code.");
				}

				String codePart = XString.parseAfterLast(passCode, "-");

				String nodeCodePart = userNode[0].getStringProp(NodeProp.USER_PREF_PASSWORD_RESET_AUTHCODE.s());
				if (!codePart.equals(nodeCodePart)) {
					throw ExUtil.newEx("Invald password reset code.");
				}

				String password = req.getNewPassword();
				userName[0] = userNode[0].getStringProp(NodeProp.USER.s());

				if (PrincipalName.ADMIN.s().equals(userName[0])) {
					throw new RuntimeException("changePassword should not be called fror admin user.");
				}

				userNode[0].setProp(NodeProp.PWD_HASH.s(), api.getHashOfPassword(password));
				userNode[0].deleteProp(NodeProp.USER_PREF_PASSWORD_RESET_AUTHCODE.s());

				// note: the adminRunner.run saves the session so we don't do that here.
			});
		} else {
			userNode[0] = api.getUserNodeByUserName(session, session.getUser());

			if (userNode[0] == null) {
				throw ExUtil.newEx("changePassword cannot find user.");
			}

			if (PrincipalName.ADMIN.s().equals(userName[0])) {
				throw new RuntimeException("changePassword should not be called fror admin user.");
			}

			String password = req.getNewPassword();
			userName[0] = userNode[0].getStringProp(NodeProp.USER.s());
			userNode[0].setProp(NodeProp.PWD_HASH.s(), api.getHashOfPassword(password));
			userNode[0].deleteProp(NodeProp.USER_PREF_PASSWORD_RESET_AUTHCODE.s());

			api.save(session, userNode[0]);
		}

		res.setUser(userName[0]);
		sessionContext.setPassword(req.getNewPassword());
		res.setSuccess(true);
		return res;
	}

	public boolean isNormalUserName(String userName) {
		userName = userName.trim();
		return !userName.equalsIgnoreCase(PrincipalName.ADMIN.s())
				&& !userName.equalsIgnoreCase(PrincipalName.ANON.s());
	}

	public ResetPasswordResponse resetPassword(final ResetPasswordRequest req) {
		ResetPasswordResponse res = new ResetPasswordResponse();
		adminRunner.run(session -> {

			String user = req.getUser();
			String email = req.getEmail();

			/* make sure username itself is acceptalbe */
			if (!isNormalUserName(user)) {
				res.setMessage("User name is illegal.");
				res.setSuccess(false);
				return;
			}

			SubNode ownerNode = api.getUserNodeByUserName(session, user);
			if (ownerNode == null) {
				res.setMessage("User does not exist.");
				res.setSuccess(false);
				return;
			}

			/*
			 * IMPORTANT!
			 *
			 * verify that the email address provides IS A MATCH to the email address for
			 * this user! Important step here because without this check anyone would be
			 * able to completely hijack anyone else's account simply by issuing a password
			 * change to that account!
			 */
			String nodeEmail = ownerNode.getStringProp(NodeProp.EMAIL.s());
			if (nodeEmail == null || !nodeEmail.equals(email)) {
				res.setMessage("Wrong user name and/or email.");
				res.setSuccess(false);
				return;
			}

			/*
			 * if we make it to here the user and email are both correct, and we can
			 * initiate the password reset. We pick some random time between 1 and 2 days
			 * from now into the future to serve as the unguessable auth code AND the expire
			 * time for it. Later we can create a deamon processor that cleans up expired
			 * authCodes, but for now we just need to HAVE the auth code.
			 *
			 * User will be emailed this code and we will perform reset when we see it, and
			 * the user has entered new password we can use.
			 */
			int oneDayMillis = 60 * 60 * 1000;
			long authCode = new Date().getTime() + oneDayMillis + rand.nextInt(oneDayMillis);

			ownerNode.setProp(NodeProp.USER_PREF_PASSWORD_RESET_AUTHCODE.s(), String.valueOf(authCode));
			api.save(session, ownerNode);

			String passCode = ownerNode.getId().toHexString() + "-" + String.valueOf(authCode);

			String link = constProvider.getHostAndPort() + "?passCode=" + passCode;
			String content = "Password reset was requested on Quantizr account: " + user + //
			"<p>\nGo to this link to reset your password: <br>\n" + link;

			outboxMgr.queueEmail(email, "Quantizr Password Reset", content);

			res.setMessage("A password reset link has been sent to your email. Check your email in a minute or so.");
			res.setSuccess(true);
		});
		return res;
	}
}
