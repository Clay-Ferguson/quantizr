package org.subnode.service;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.util.Base64;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Random;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.apache.commons.lang3.StringUtils;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.subnode.config.AppProp;
import org.subnode.config.ConstantsProvider;
import org.subnode.config.SessionContext;
import org.subnode.exception.OutOfSpaceException;
import org.subnode.exception.base.RuntimeEx;
import org.subnode.mail.OutboxMgr;
import org.subnode.model.UserPreferences;
import org.subnode.model.UserStats;
import org.subnode.model.client.NodeProp;
import org.subnode.model.client.NodeType;
import org.subnode.model.client.PrincipalName;
import org.subnode.mongo.MongoUtil;
import org.subnode.mongo.MongoAuth;
import org.subnode.mongo.MongoDelete;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.MongoUpdate;
import org.subnode.mongo.RunAsMongoAdmin;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.ChangePasswordRequest;
import org.subnode.request.CloseAccountRequest;
import org.subnode.request.GetFriendsRequest;
import org.subnode.request.GetUserAccountInfoRequest;
import org.subnode.request.GetUserProfileRequest;
import org.subnode.request.ResetPasswordRequest;
import org.subnode.request.SavePublicKeyRequest;
import org.subnode.request.SaveUserPreferencesRequest;
import org.subnode.request.SaveUserProfileRequest;
import org.subnode.request.SignupRequest;
import org.subnode.request.base.RequestBase;
import org.subnode.response.ChangePasswordResponse;
import org.subnode.response.CloseAccountResponse;
import org.subnode.response.FriendInfo;
import org.subnode.response.GetFriendsResponse;
import org.subnode.response.GetUserAccountInfoResponse;
import org.subnode.response.GetUserProfileResponse;
import org.subnode.response.LoginResponse;
import org.subnode.response.ResetPasswordResponse;
import org.subnode.response.SavePublicKeyResponse;
import org.subnode.response.SaveUserPreferencesResponse;
import org.subnode.response.SaveUserProfileResponse;
import org.subnode.response.SignupResponse;
import org.subnode.util.Const;
import org.subnode.util.DateUtil;
import org.subnode.util.ExUtil;
import org.subnode.util.ThreadLocals;
import org.subnode.util.Util;
import org.subnode.util.ValContainer;
import org.subnode.util.Validator;
import org.subnode.util.XString;

/**
 * Service methods for processing user management functions. Login, logout,
 * signup, user preferences, and settings persisted per-user
 */
@Component
public class UserManagerService {
	private static final Logger log = LoggerFactory.getLogger(UserManagerService.class);

	private static final Random rand = new Random();

	@Autowired
	private MongoUtil util;

	@Autowired
	private MongoAuth auth;

	@Autowired
	private MongoRead read;

	@Autowired
	private MongoUpdate update;

	@Autowired
	private MongoDelete delete;

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
	 * RestTempalte is thread-safe and reusable, and has no state, so we need only
	 * one final static instance ever
	 */
	private static final RestTemplate restTemplate = new RestTemplate(Util.getClientHttpRequestFactory());

	private static final ObjectMapper mapper = new ObjectMapper();

	/*
	 * Login mechanism is a bit tricky because the CallProcessor detects the
	 * LoginRequest and performs authentication BEFORE this 'login' method even gets
	 * called, so by the time we are in this method we can safely assume the
	 * userName and password resulted in a successful login.
	 */
	public LoginResponse login(MongoSession session, RequestBase req) {
		LoginResponse res = new LoginResponse();
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}

		String userName = req.getUserName();
		log.debug("login: user=" + userName);

		if (userName.equals("")) {
			userName = sessionContext.getUserName();
			req.setUserName(userName);
		}

		/*
		 * We have to get timezone information from the user's browser, so that all
		 * times on all nodes always show up in their precise local time!
		 */
		sessionContext.init(req);

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
			processLogin(session, res, userName);
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

	public void processLogin(MongoSession session, LoginResponse res, String userName) {
		SubNode userNode = read.getUserNodeByUserName(session, userName);
		if (userNode == null) {
			throw new RuntimeEx("User not found: " + userName);
		}

		String id = userNode.getId().toHexString();
		sessionContext.setRootId(id);

		UserPreferences userPreferences = getUserPreferences(userName);
		sessionContext.setUserPreferences(userPreferences);

		if (res != null) {
			res.setRootNode(id);
			res.setRootNodePath(userNode.getPath());
			res.setUserName(userName);
			res.setAllowFileSystemSearch(appProp.isAllowFileSystemSearch());
			res.setUserPreferences(userPreferences);
		}

		Date now = new Date();
		sessionContext.setLastLoginTime(now.getTime());
		userNode.setProp(NodeProp.LAST_LOGIN_TIME.s(), now.getTime());

		ensureValidCryptoKeys(userNode);
		update.save(session, userNode);
	}

	/*
	 * Creates crypto key properties if not already existing
	 * 
	 * no longer used.
	 */
	public void ensureValidCryptoKeys(SubNode userNode) {
		try {
			String publicKey = userNode.getStrProp(NodeProp.CRYPTO_KEY_PUBLIC.s());
			if (publicKey == null) {
				KeyPairGenerator kpg = KeyPairGenerator.getInstance("RSA");
				kpg.initialize(2048);
				KeyPair pair = kpg.generateKeyPair();

				publicKey = Base64.getEncoder().encodeToString(pair.getPublic().getEncoded());
				String privateKey = Base64.getEncoder().encodeToString(pair.getPrivate().getEncoded());

				userNode.setProp(NodeProp.CRYPTO_KEY_PUBLIC.s(), publicKey);
				userNode.setProp(NodeProp.CRYPTO_KEY_PRIVATE.s(), privateKey);
			}
		} catch (Exception e) {
			log.error("failed creating crypto keys", e);
		}
	}

	public CloseAccountResponse closeAccount(CloseAccountRequest req) {
		CloseAccountResponse res = new CloseAccountResponse();
		log.debug("Closing Account: " + sessionContext.getUserName());
		adminRunner.run(session -> {
			String userName = sessionContext.getUserName();

			SubNode ownerNode = read.getUserNodeByUserName(session, userName);
			if (ownerNode != null) {
				delete.delete(session, ownerNode, false);
			}
		});
		return res;
	}

	/**
	 * @param session
	 * @param userStats Holds a map of User Root Node (account node) IDs as key
	 *                  mapped to the UserStats for that user.
	 */
	public void writeUserStats(final MongoSession session, HashMap<ObjectId, UserStats> userStats) {
		userStats.forEach((final ObjectId key, final UserStats stat) -> {
			SubNode node = read.getNode(session, key);
			if (node != null) {
				// log.debug("Setting stat.binUsage=" + stat.binUsage);
				node.setProp(NodeProp.BIN_TOTAL.s(), stat.binUsage);
				node.setProp(NodeProp.BIN_QUOTA.s(), Const.DEFAULT_USER_QUOTA);
			} else {
				log.debug("Node not found by key: " + key);
			}
		});
	}

	/**
	 * increments the userNode usasage bytes by adding the bytes the attachment uses
	 * on 'node'
	 * 
	 * @param node
	 * @param userNode
	 * @param sign     Controls if this is a subtract or an add (should be always 1
	 *                 or -1)
	 */
	public void addNodeBytesToUserNodeBytes(SubNode node, SubNode userNode, int sign) {
		if (node == null) {
			throw new RuntimeEx("node was null.");
		}

		// get the size of the attachment on this node
		long binSize = node.getIntProp(NodeProp.BIN_SIZE.s());
		if (binSize > 0L) {
			// log.debug("Will +/- amt: " + binSize);

			if (userNode == null) {
				userNode = read.getUserNodeByUserName(null, null);
			}

			addBytesToUserNodeBytes(binSize, userNode, sign);
		}
	}

	/*
	 * We have 'sign' so we can use this method to either deduct from or add to the
	 * user's total usage amount
	 */
	public void addBytesToUserNodeBytes(long binSize, SubNode userNode, int sign) {
		if (userNode == null) {
			userNode = read.getUserNodeByUserName(null, null);
		}

		// get the current binTotal on the user account (max they are allowed to upload)
		Long binTotal = userNode.getIntProp(NodeProp.BIN_TOTAL.s());
		if (binTotal == null) {
			binTotal = 0L;
		}

		// log.debug("before binTotal=" + binTotal);
		binTotal += sign * binSize;
		if (binTotal < 0) {
			binTotal = 0L;
		}

		Long userQuota = userNode.getIntProp(NodeProp.BIN_QUOTA.s());
		if (binTotal > userQuota) {
			throw new OutOfSpaceException();
		}

		// log.debug("after binTotal=" + binTotal);
		userNode.setProp(NodeProp.BIN_TOTAL.s(), binTotal);
	}

	/*
	 * Processes last step of signup, which is validation of registration code. This
	 * means user has clicked the link they were sent during the signup email
	 * verification, and they are sending in a signupCode that will turn on their
	 * account and actually create their account.
	 * 
	 * We return whatever a message would be to the user that just says if the
	 * signupCode was accepted or not and it's displayed on welcome.html only.
	 */
	public String processSignupCode(final String signupCode) {
		log.debug("User is trying signupCode: " + signupCode);
		final ValContainer<String> valContainer = new ValContainer<String>(null);
		adminRunner.run(session -> {
			// signupCode is just the new account node id? I guess that's secure, if user
			// has this value it's the only user
			// who could possibly know this unguessable value.
			SubNode node = read.getNode(session, signupCode);

			if (node != null) {
				if (!node.getBooleanProp(NodeProp.SIGNUP_PENDING.s())) {
					valContainer.setVal("Signup Complete. You may login now.");
					return;
				}

				String userName = node.getStrProp(NodeProp.USER.s());

				if (PrincipalName.ADMIN.s().equalsIgnoreCase(userName)) {
					valContainer.setVal("processSignupCode should not be called for admin user.");
					return;
				}

				node.deleteProp(NodeProp.SIGNUP_PENDING.s());
				update.save(session, node);

				valContainer.setVal("Signup Successful. You may login now.");
			} else {
				valContainer.setVal("Signup Code is invalid.");
			}
		});
		return valContainer.getVal();
	}

	public void initNewUser(MongoSession session, String userName, String password, String email, boolean automated) {
		SubNode userNode = util.createUser(session, userName, email, password, automated);
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
		MongoSession session = auth.getAdminSession();
		SignupResponse res = new SignupResponse();

		final String userName = req.getUserName().trim();
		final String password = req.getPassword().trim();
		final String email = req.getEmail();

		// Recaptcha was creating some VERY bizarre rendering problems. Apparenty they
		// way it tries to inject itself into
		// the webpage is flawed in some way and I really don't want that anyway.
		// Perhaps I can render the 'signup' page ONLY
		// with recaptcha enabled, and for every other page in the system have it
		// completely removed from any HTML/JS. (todo-1)
		// #recaptcha-disabled
		// if (!verifyCaptcha(req.getReCaptchaToken())) {
		// res.setMessage("Sorry, reCaptcha scored too low.");
		// res.setSuccess(false);
		// return res;
		// }

		log.debug("Signup: userName=" + userName + " email=" + email);

		res.setSuccess(true);

		/* throw exceptions of the username or password are not valid */
		String userError = validator.checkUserName(userName);
		if (userError != null) {
			res.setUserError(userError);
			res.setSuccess(false);
		}

		String passwordError = validator.checkPassword(password);
		if (passwordError != null) {
			res.setPasswordError(passwordError);
			res.setSuccess(false);
		}

		String emailError = validator.checkEmail(email);
		if (emailError != null) {
			res.setEmailError(emailError);
			res.setSuccess(false);
		}

		if (!res.isSuccess()) {
			return res;
		}

		if (!automated) {
			initiateSignup(session, userName, password, email);
		} else {
			initNewUser(session, userName, password, email, automated);
		}

		res.setMessage("success");
		return res;
	}

	private boolean verifyCaptcha(String reCaptchaToken) {
		boolean ret = false;
		try {
			String secretKey = appProp.getReCaptcha3SecretKey();

			// if secret key not configured, bypass check.
			if (StringUtils.isEmpty(secretKey)) {
				return true;
			}
			String url = "https://www.google.com/recaptcha/api/siteverify?secret=" + secretKey + "&response="
					+ reCaptchaToken;

			HttpHeaders headers = new HttpHeaders();
			HttpEntity<String> requestEntity = new HttpEntity<>("", headers);

			ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, requestEntity, String.class);
			// log.debug("RAW RESULT: " + response.getBody());

			Map<String, Object> respMap = mapper.readValue(response.getBody(),
					new TypeReference<Map<String, Object>>() {
					});
			// log.debug(XString.prettyPrint(respMap));

			Boolean success = (Boolean) respMap.get("success");
			Double score = (Double) respMap.get("score");

			// Google recommends 0.5 as default threshold:
			// https://developers.google.com/recaptcha/docs/v3
			if (success.booleanValue() && score.doubleValue() >= 0.5) {
				// log.debug("Success=" + success + " score=" + score);
				ret = true;
			}

		} catch (Exception e) {
			log.error("Failed in restTemplate.exchange", e);
		}
		return ret;
	}

	/*
	 * Adds user to the list of pending accounts and they will stay in pending
	 * status until their signupCode has been used to validate their email address.
	 */
	public void initiateSignup(MongoSession session, String userName, String password, String email) {

		SubNode ownerNode = read.getUserNodeByUserName(session, userName);
		if (ownerNode != null) {
			throw new RuntimeEx("User already exists.");
		}

		SubNode newUserNode = util.createUser(session, userName, email, password, false);

		/*
		 * It's easiest to use the actua new UserNode ID as the 'signup code' to send to
		 * the user, because it's random and tied to this user by definition
		 */
		String signupCode = newUserNode.getId().toHexString();
		String signupLink = appProp.getHttpProtocol() + "://" + appProp.getMetaHost() + "?signupCode=" + signupCode;
		String content = null;

		/*
		 * We print this out so we can use it in DEV mode when no email support may be
		 * configured
		 */
		log.debug("Signup URL: " + signupLink);

		content = "Welcome to Quanta: " + userName + //
				"<p>\nClick this link to complete signup: <br>\n" + signupLink;

		if (!StringUtils.isEmpty(appProp.getMailHost())) {
			outboxMgr.queueEmail(email, "Quanta - Account Signup", content);
		}
	}

	public void setDefaultUserPreferences(SubNode prefsNode) {
		prefsNode.setProp(NodeProp.USER_PREF_EDIT_MODE.s(), false);
	}

	public SavePublicKeyResponse savePublicKey(final SavePublicKeyRequest req) {
		SavePublicKeyResponse res = new SavePublicKeyResponse();
		final String userName = sessionContext.getUserName();

		adminRunner.run(session -> {
			SubNode userNode = read.getUserNodeByUserName(session, userName);

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

	public GetUserAccountInfoResponse getUserAccountInfo(final GetUserAccountInfoRequest req) {
		GetUserAccountInfoResponse res = new GetUserAccountInfoResponse();
		final String userName = sessionContext.getUserName();

		adminRunner.run(session -> {
			SubNode userNode = read.getUserNodeByUserName(session, userName);
			if (userNode == null) {
				res.setMessage("unknown user.");
				res.setSuccess(false);
			}

			Long binQuota = userNode.getIntProp(NodeProp.BIN_QUOTA.s());
			Long binTotal = userNode.getIntProp(NodeProp.BIN_TOTAL.s());

			// I really need to convert these props to Integers not Strings
			res.setBinQuota(binQuota == null ? -1 : binQuota.intValue());
			res.setBinTotal(binTotal == null ? -1 : binTotal.intValue());
			res.setSuccess(true);
		});
		return res;
	}

	public SaveUserPreferencesResponse saveUserPreferences(final SaveUserPreferencesRequest req) {
		SaveUserPreferencesResponse res = new SaveUserPreferencesResponse();

		UserPreferences userPreferences = sessionContext.getUserPreferences();
		// note: This will be null if session has timed out.
		if (userPreferences == null) {
			return res;
		}

		final String userName = sessionContext.getUserName();

		adminRunner.run(session -> {
			SubNode prefsNode = read.getUserNodeByUserName(session, userName);

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
			userPreferences.setEditMode(editMode);
			userPreferences.setShowMetaData(showMetaData);

			res.setSuccess(true);
		});
		return res;
	}

	public SaveUserProfileResponse saveUserProfile(final SaveUserProfileRequest req) {
		SaveUserProfileResponse res = new SaveUserProfileResponse();
		final String userName = sessionContext.getUserName();

		adminRunner.run(session -> {
			boolean failed = false;
			SubNode userNode = read.getUserNodeByUserName(session, userName);

			// DO NOT DELETE: This is temporaryly disabled (no ability to edit userNaem)
			// If userName is changing, validate it first.
			// if (!req.getUserName().equals(userName)) {
			// validator.checkUserName(req.getUserName());

			// SubNode nodeFound = api.getUserNodeByUserName(session, req.getUserName());
			// if (nodeFound != null) {
			// res.setMessage("User already exists.");
			// res.setSuccess(false);
			// failed = true;
			// }
			// }

			if (!failed) {
				// userNode.setProp(NodeProp.USER.s(), req.getUserName());
				userNode.setProp(NodeProp.USER_BIO.s(), req.getUserBio());
				// sessionContext.setUserName(req.getUserName());
				update.save(session, userNode);
				res.setSuccess(true);
			}
		});
		return res;
	}

	public GetUserProfileResponse getUserProfile(final GetUserProfileRequest req) {
		GetUserProfileResponse res = new GetUserProfileResponse();
		final String userName = sessionContext.getUserName();

		adminRunner.run(session -> {
			SubNode userNode = null;

			if (req.getUserId() == null) {
				userNode = read.getUserNodeByUserName(session, userName);
			} else {
				userNode = read.getNode(session, req.getUserId(), false);
			}

			if (userNode != null) {
				res.setUserName(userNode.getStrProp(NodeProp.USER.s()));
				res.setUserBio(userNode.getStrProp(NodeProp.USER_BIO.s()));
				res.setAvatarVer(userNode.getStrProp(NodeProp.BIN.s()));
				res.setHeaderImageVer(userNode.getStrProp(NodeProp.BIN.s()+"Header"));
				res.setUserNodeId(userNode.getId().toHexString());
				res.setSuccess(true);
			}
		});
		return res;
	}

	public UserPreferences getDefaultUserPreferences() {
		return new UserPreferences();
	}

	public UserPreferences getUserPreferences(String userName) {
		final UserPreferences userPrefs = new UserPreferences();

		adminRunner.run(session -> {
			SubNode prefsNode = read.getUserNodeByUserName(session, userName);
			userPrefs.setEditMode(prefsNode.getBooleanProp(NodeProp.USER_PREF_EDIT_MODE.s()));
			userPrefs.setShowMetaData(prefsNode.getBooleanProp(NodeProp.USER_PREF_SHOW_METADATA.s()));

			long maxFileSize = prefsNode.getIntProp(NodeProp.BIN_QUOTA.s());
			if (maxFileSize == 0) {
				maxFileSize = Const.DEFAULT_USER_QUOTA;
			}
			userPrefs.setMaxUploadFileSize(maxFileSize);
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
					throw new RuntimeEx("Unable to find userNodeId: " + userNodeId);
				}
				userNode[0] = read.getNode(mongoSession, userNodeId);

				if (userNode[0] == null) {
					throw ExUtil.wrapEx("Invald password reset code.");
				}

				String codePart = XString.parseAfterLast(passCode, "-");

				String nodeCodePart = userNode[0].getStrProp(NodeProp.USER_PREF_PASSWORD_RESET_AUTHCODE.s());
				if (!codePart.equals(nodeCodePart)) {
					throw ExUtil.wrapEx("Invald password reset code.");
				}

				String password = req.getNewPassword();
				userName[0] = userNode[0].getStrProp(NodeProp.USER.s());

				if (PrincipalName.ADMIN.s().equals(userName[0])) {
					throw new RuntimeEx("changePassword should not be called fror admin user.");
				}

				userNode[0].setProp(NodeProp.PWD_HASH.s(), util.getHashOfPassword(password));
				userNode[0].deleteProp(NodeProp.USER_PREF_PASSWORD_RESET_AUTHCODE.s());

				// note: the adminRunner.run saves the session so we don't do that here.
			});
		} else {
			userNode[0] = read.getUserNodeByUserName(session, session.getUser());

			if (userNode[0] == null) {
				throw ExUtil.wrapEx("changePassword cannot find user.");
			}

			if (PrincipalName.ADMIN.s().equals(userName[0])) {
				throw new RuntimeEx("changePassword should not be called fror admin user.");
			}

			String password = req.getNewPassword();
			userName[0] = userNode[0].getStrProp(NodeProp.USER.s());
			userNode[0].setProp(NodeProp.PWD_HASH.s(), util.getHashOfPassword(password));
			userNode[0].deleteProp(NodeProp.USER_PREF_PASSWORD_RESET_AUTHCODE.s());

			update.save(session, userNode[0]);
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

			SubNode ownerNode = read.getUserNodeByUserName(session, user);
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
			String nodeEmail = ownerNode.getStrProp(NodeProp.EMAIL.s());
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
			update.save(session, ownerNode);

			String passCode = ownerNode.getId().toHexString() + "-" + String.valueOf(authCode);

			String link = constProvider.getHostAndPort() + "?passCode=" + passCode;
			String content = "Password reset was requested on Quanta account: " + user + //
			"<p>\nGo to this link to reset your password: <br>\n" + link;

			outboxMgr.queueEmail(email, "Quanta Password Reset", content);

			res.setMessage("A password reset link has been sent to your email. Check your email in a minute or so.");
			res.setSuccess(true);
		});
		return res;
	}

	public GetFriendsResponse getFriends(MongoSession session, GetFriendsRequest req) {
		GetFriendsResponse res = new GetFriendsResponse();
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}

		List<FriendInfo> friends = new LinkedList<FriendInfo>();

		SubNode userNode = read.getUserNodeByUserName(session, null);
		if (userNode == null)
			return res;

		SubNode friendsNode = read.findTypedNodeUnderPath(session, userNode.getPath(), NodeType.FRIEND_LIST.s());
		if (friendsNode == null)
			return res;

		//Note: findFollowingOfUser method has similar code to this, and we should unify it so we only do it one way (todo-0)
		for (SubNode friendNode : read.getChildren(session, friendsNode, null, null, 0)) {
			String userName = friendNode.getStrProp(NodeProp.USER.s());
			if (userName != null) {
				FriendInfo fi = new FriendInfo();
				fi.setUserName(userName);
				friends.add(fi);
			}
		}

		res.setFriends(friends);
		res.setSuccess(true);
		return res;
	}
}
