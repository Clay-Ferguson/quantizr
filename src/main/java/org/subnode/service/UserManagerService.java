package org.subnode.service;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.util.Arrays;
import java.util.Base64;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;
import org.apache.commons.lang3.StringUtils;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;
import org.subnode.actpub.ActPubFollower;
import org.subnode.actpub.ActPubFollowing;
import org.subnode.actpub.ActPubService;
import org.subnode.config.AppProp;
import org.subnode.config.NodeName;
import org.subnode.config.SessionContext;
import org.subnode.exception.OutOfSpaceException;
import org.subnode.exception.base.RuntimeEx;
import org.subnode.mail.OutboxMgr;
import org.subnode.model.UserPreferences;
import org.subnode.model.UserStats;
import org.subnode.model.client.NodeProp;
import org.subnode.model.client.NodeType;
import org.subnode.model.client.PrincipalName;
import org.subnode.model.client.PrivilegeType;
import org.subnode.model.client.UserProfile;
import org.subnode.mongo.AdminRun;
import org.subnode.mongo.CreateNodeLocation;
import org.subnode.mongo.MongoAuth;
import org.subnode.mongo.MongoCreate;
import org.subnode.mongo.MongoDelete;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.MongoThreadLocal;
import org.subnode.mongo.MongoUpdate;
import org.subnode.mongo.MongoUtil;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.AddFriendRequest;
import org.subnode.request.BlockUserRequest;
import org.subnode.request.ChangePasswordRequest;
import org.subnode.request.CloseAccountRequest;
import org.subnode.request.GetUserAccountInfoRequest;
import org.subnode.request.GetUserProfileRequest;
import org.subnode.request.LoginRequest;
import org.subnode.request.ResetPasswordRequest;
import org.subnode.request.SavePublicKeyRequest;
import org.subnode.request.SaveUserPreferencesRequest;
import org.subnode.request.SaveUserProfileRequest;
import org.subnode.request.SignupRequest;
import org.subnode.response.AddFriendResponse;
import org.subnode.response.BlockUserResponse;
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
import org.subnode.util.ValContainer;
import org.subnode.util.Validator;
import org.subnode.util.XString;

/**
 * Service methods for processing user management functions. Login, logout, signup, user
 * preferences, and settings persisted per-user
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
	private MongoCreate create;

	@Autowired
	private MongoUpdate update;

	@Autowired
	private MongoDelete delete;

	@Autowired
	private AppProp appProp;

	@Autowired
	private OutboxMgr outboxMgr;

	@Autowired
	private AdminRun arun;

	@Autowired
	private AclService acu;

	@Autowired
	private Validator validator;

	@Autowired
	private NodeEditService edit;

	@Autowired
	private ActPubFollowing apFollowing;

	@Autowired
	private ActPubFollower apFollower;

	@Autowired
	private ActPubService apService;

	@Autowired
	private AclService acl;

	@Autowired
	private SessionContext sc;

	/* Private keys of each user by user name as key */
	public static final ConcurrentHashMap<String, String> privateKeysByUserName = new ConcurrentHashMap<>();

	/*
	 * Note that this function does 'succeed' even with ANON user given, and just considers that an
	 * anonymouse user
	 */
	public LoginResponse login(LoginRequest req) {
		LoginResponse res = new LoginResponse();
		// log.debug("login: " + XString.prettyPrint(req));

		/* Anonymous user */
		if (req.getUserName() == null || PrincipalName.ANON.s().equals(req.getUserName())) {
			log.debug("Anonymous user login.");
		}
		/* Admin Login */
		else if (PrincipalName.ADMIN.s().equals(req.getUserName())) {
			if (req.getPassword().equals(appProp.getMongoAdminPassword())) {
				sc.setAuthenticated(req.getUserName());
			} else
				throw new RuntimeEx("Login failed. Wrong admin password.");
		}
		/* User Login */
		else {
			// try to lookup the actual user's node
			SubNode userNode = read.getUserNodeByUserName(auth.getAdminSession(), req.getUserName());

			// we found user's node.
			if (userNode != null) {
				/**
				 * We can log in as any user we want if we have the admin password.
				 */
				if (req.getPassword().equals(appProp.getMongoAdminPassword())) {
					sc.setAuthenticated(req.getUserName());
				}
				// else it's an ordinary user so we check the password against their user node
				else if (userNode.getStrProp(NodeProp.PWD_HASH.s()).equals(util.getHashOfPassword(req.getPassword()))) {
					sc.setAuthenticated(req.getUserName());
				} else {
					throw new RuntimeEx("Login failed. Wrong password for user: " + req.getUserName());
				}
			} else {
				throw new RuntimeEx("Login failed. User not found: " + req.getUserName());
			}
		}

		/*
		 * We have to get timezone information from the user's browser, so that all times on all nodes
		 * always show up in their precise local time!
		 */
		sc.setTimezone(DateUtil.getTimezoneFromOffset(req.getTzOffset()));
		sc.setTimeZoneAbbrev(DateUtil.getUSTimezone(-req.getTzOffset() / 60, req.getDst()));

		res.setAnonUserLandingPageNode(appProp.getUserLandingPageNode());
		log.debug("Processing Login: urlId=" + (sc.getUrlId() != null ? sc.getUrlId() : "null"));

		if (sc.getUrlId() != null) {
			// log.debug("setHomeNodeOverride (from session urlId): " + sc.getUrlId());
			res.setHomeNodeOverride(sc.getUrlId());
		}

		if (sc.isAuthenticated()) {
			MongoSession session = new MongoSession(sc.getUserName());
			SubNode userNode = read.getUserNodeByUserName(auth.getAdminSession(), sc.getUserName());
			if (userNode == null) {
				throw new RuntimeException("UserNode not found for userName " + sc.getUserName());
			}
			session.setUserNodeId(userNode.getId());
			sc.setMongoSession(session);
			MongoThreadLocal.setMongoSession(session);

			processLogin(session, res, sc.getUserName());
			log.debug("login: user=" + sc.getUserName());

			// ensure we've pre-created this node.
			SubNode postsNode = read.getUserNodeByType(session, sc.getUserName(), null, "### Posts", NodeType.POSTS.s(),
					Arrays.asList(PrivilegeType.READ.s()), NodeName.POSTS);

			ensureUserHomeNodeExists(session, sc.getUserName(), "### " + sc.getUserName()
					+ "'s Public Node &#x1f389;\n\nEdit the content and children of this node. It represents you to the outside world.\n\n"
					+ "Go here for a Quick Start guide: * https://quanta.wiki/n/quick-start", NodeType.NONE.s(), NodeName.HOME);
		} else {
			res.setUserPreferences(getDefaultUserPreferences());
		}

		res.setUserName(sc.getUserName());
		// note, this is a valid path even for 'anon' user.
		res.setMessage("login ok.");
		res.setSuccess(true);
		return res;
	}

	public void ensureUserHomeNodeExists(MongoSession session, String userName, String content, String type, String name) {
		SubNode userNode = read.getUserNodeByUserName(session, userName);
		if (userNode != null) {
			SubNode userHomeNode = read.getNodeByName(session, userName + ":" + name);
			if (userHomeNode == null) {
				SubNode node = create.createNode(session, userNode, null, type, 0L, CreateNodeLocation.LAST, null, null, true);
				node.setOwner(userNode.getId());
				if (name != null) {
					node.setName(name);
				}
				node.setContent(content);
				node.touch();
				acl.addPrivilege(session, node, PrincipalName.PUBLIC.s(), Arrays.asList(PrivilegeType.READ.s()), null);
				update.save(session, node);
			}
		}
	}

	public void processLogin(MongoSession session, LoginResponse res, String userName) {

		// log.debug("processLogin: " + userName);
		SubNode userNode = read.getUserNodeByUserName(auth.getAdminSession(), userName);

		if (userNode == null) {
			throw new RuntimeEx("User not found: " + userName);
		}

		String id = userNode.getId().toHexString();
		if (id == null) {
			throw new RuntimeException("userNode id is null for user: " + userName);
		}
		sc.setRootId(id);

		UserPreferences userPreferences = getUserPreferences(userName, userNode);
		sc.setUserPreferences(userPreferences);

		res.setRootNode(id);
		res.setRootNodePath(userNode.getPath());

		// be sure to get userName off node so case sensitivity is exact.
		res.setUserName(userNode.getStrProp(NodeProp.USER));
		res.setDisplayName(userNode.getStrProp(NodeProp.DISPLAY_NAME));

		res.setAllowFileSystemSearch(appProp.isAllowFileSystemSearch());
		res.setUserPreferences(userPreferences);
		res.setAuthToken(sc.getUserToken());

		Date now = new Date();
		sc.setLastLoginTime(now.getTime());
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
		log.debug("Closing Account: " + ThreadLocals.getSessionContext().getUserName());
		arun.run(session -> {
			String userName = ThreadLocals.getSessionContext().getUserName();

			SubNode ownerNode = read.getUserNodeByUserName(session, userName);
			if (ownerNode != null) {
				delete.delete(session, ownerNode, false);
			}
			return null;
		});
		return res;
	}

	/**
	 * @param session
	 * @param userStats Holds a map of User Root Node (account node) IDs as key mapped to the UserStats
	 *        for that user.
	 */
	public void writeUserStats(final MongoSession session, HashMap<ObjectId, UserStats> userStats) {
		userStats.forEach((final ObjectId key, final UserStats stat) -> {
			SubNode node = read.getNode(session, key);
			if (node != null) {
				// log.debug("Setting stat.binUsage=" + stat.binUsage);
				node.setProp(NodeProp.BIN_TOTAL.s(), stat.binUsage);
			} else {
				log.debug("Node not found by key: " + key);
			}
		});
	}

	/**
	 * increments the userNode usasage bytes by adding the bytes the attachment uses on 'node'
	 * 
	 * @param node
	 * @param userNode
	 * @param sign Controls if this is a subtract or an add (should be always 1 or -1)
	 */
	public void addNodeBytesToUserNodeBytes(SubNode node, SubNode userNode, int sign) {
		if (node == null) {
			/*
			 * todo-1: need to investigate this. I did a public shared node from one user and had a conversation
			 * thread under it and got this thrown upon deleting the root of that. For now ignoring a null node
			 * here.
			 */
			return;
			// throw new RuntimeEx("node was null.");
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
	 * We have 'sign' so we can use this method to either deduct from or add to the user's total usage
	 * amount
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
	 * Processes last step of signup, which is validation of registration code. This means user has
	 * clicked the link they were sent during the signup email verification, and they are sending in a
	 * signupCode that will turn on their account and actually create their account.
	 * 
	 * We return whatever a message would be to the user that just says if the signupCode was accepted
	 * or not and it's displayed on welcome.html only.
	 */
	public String processSignupCode(final String signupCode) {
		log.debug("User is trying signupCode: " + signupCode);
		return arun.run(session -> {

			// signupCode is just the new account node id? I guess that's secure, if user
			// has this value it's the only user
			// who could possibly know this unguessable value.
			SubNode node = read.getNode(session, signupCode);

			if (node != null) {
				if (!node.getBooleanProp(NodeProp.SIGNUP_PENDING.s())) {
					return "Signup Complete. You may login now.";
				} else {
					String userName = node.getStrProp(NodeProp.USER.s());

					if (PrincipalName.ADMIN.s().equalsIgnoreCase(userName)) {
						return "processSignupCode should not be called for admin user.";
					} else {
						node.deleteProp(NodeProp.SIGNUP_PENDING.s());
						update.save(session, node);
						return "Signup Successful. You may login now.";
					}
				}
			} else {
				return "Signup Code is invalid.";
			}
		});
	}

	public void initNewUser(MongoSession session, String userName, String password, String email, boolean automated) {
		SubNode userNode = util.createUser(session, userName, email, password, automated);
		if (userNode != null) {
			log.debug("Successful signup complete.");
		}
	}

	public List<String> getOwnerNames(SubNode node) {
		final ValContainer<List<String>> ret = new ValContainer<List<String>>();
		arun.run(session -> {
			ret.setVal(acu.getOwnerNames(session, node));
			return null;
		});
		return ret.getVal();
	}

	/*
	 * Processes a signup request from a user. We create the user root node in a pending state, and like
	 * all other user accounts all information specific to that user that we currently know is held in
	 * that node (i.e. preferences)
	 */
	public SignupResponse signup(SignupRequest req, boolean automated) {
		SignupResponse res = new SignupResponse();
		arun.run(session -> {

			final String userName = req.getUserName().trim();
			final String password = req.getPassword().trim();
			final String email = req.getEmail();

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

			if (!automated) {
				if (!ThreadLocals.getSessionContext().getCaptcha().equals(req.getCaptcha())) {
					int captchaFails = ThreadLocals.getSessionContext().getCaptchaFails();

					if (captchaFails > 0) {
						try {
							// this sleep should stop brute forcing, every failed attempt makes the user
							// need to wait an additional 2 seconds each time.
							Thread.sleep(captchaFails * 2000);
						} catch (Exception e) {
						}
					}
					ThreadLocals.getSessionContext().setCaptchaFails(captchaFails + 1);
					res.setCaptchaError("Wrong captcha. Try again.");
					res.setSuccess(false);
				}
			}

			if (!res.isSuccess()) {
				return res;
			}

			if (!automated) {
				initiateSignup(session, userName, password, email);
			} else {
				initNewUser(session, userName, password, email, automated);
			}
			return null;
		});

		res.setMessage("success");
		return res;
	}

	/*
	 * Adds user to the list of pending accounts and they will stay in pending status until their
	 * signupCode has been used to validate their email address.
	 */
	public void initiateSignup(MongoSession session, String userName, String password, String email) {

		SubNode ownerNode = read.getUserNodeByUserName(session, userName);
		if (ownerNode != null) {
			throw new RuntimeEx("User already exists.");
		}

		SubNode newUserNode = util.createUser(session, userName, email, password, false);

		/*
		 * It's easiest to use the actua new UserNode ID as the 'signup code' to send to the user, because
		 * it's random and tied to this user by definition
		 */
		String signupCode = newUserNode.getId().toHexString();
		String signupLink = appProp.getHttpProtocol() + "://" + appProp.getMetaHost() + "?signupCode=" + signupCode;
		String content = null;

		/*
		 * We print this out so we can use it in DEV mode when no email support may be configured
		 */
		log.debug("Signup URL: " + signupLink);

		String brandingAppName = appProp.getConfigText("brandingAppName");

		content = "Welcome to " + brandingAppName + ", " + userName + "!" + //
				"<p>\nUse this link to complete the signup: <br>\n" + signupLink;

		if (!StringUtils.isEmpty(appProp.getMailHost())) {
			outboxMgr.queueEmail(email, brandingAppName + " - Account Signup", content);
		}
	}

	public void setDefaultUserPreferences(SubNode prefsNode) {
		prefsNode.setProp(NodeProp.USER_PREF_EDIT_MODE.s(), false);
		prefsNode.setProp(NodeProp.USER_PREF_RSS_HEADINGS_ONLY.s(), true);
	}

	public SavePublicKeyResponse savePublicKey(final SavePublicKeyRequest req) {
		SavePublicKeyResponse res = new SavePublicKeyResponse();
		final String userName = ThreadLocals.getSessionContext().getUserName();

		arun.run(session -> {
			SubNode userNode = read.getUserNodeByUserName(session, userName);

			if (userNode != null) {
				userNode.setProp(NodeProp.USER_PREF_PUBLIC_KEY.s(), req.getKeyJson());
			} else {
				log.debug("savePublicKey failed to find userName: " + userName);
			}
			// oops this is coming up when I don't want to see it, when the user logs in,
			// so we need to be sure to somehow only show the message when the user has
			// CLICKED
			// the actual publish keys menu
			// res.setMessage("Successfully saved public key.");
			res.setSuccess(true);
			return null;
		});
		return res;
	}

	public GetUserAccountInfoResponse getUserAccountInfo(final GetUserAccountInfoRequest req) {
		GetUserAccountInfoResponse res = new GetUserAccountInfoResponse();
		final String userName = ThreadLocals.getSessionContext().getUserName();

		arun.run(session -> {
			SubNode userNode = read.getUserNodeByUserName(session, userName);
			if (userNode == null) {
				res.setMessage("unknown user: " + userName);
				res.setSuccess(false);
			}

			try {
				// foreign users won't have these.
				Long binQuota = userNode.getIntProp(NodeProp.BIN_QUOTA.s());
				Long binTotal = userNode.getIntProp(NodeProp.BIN_TOTAL.s());

				// I really need to convert these props to Integers not Strings
				res.setBinQuota(binQuota == null ? -1 : binQuota.intValue());
				res.setBinTotal(binTotal == null ? -1 : binTotal.intValue());
			} catch (Exception e) {
			}

			res.setSuccess(true);
			return null;
		});
		return res;
	}

	public SaveUserPreferencesResponse saveUserPreferences(final SaveUserPreferencesRequest req) {
		SaveUserPreferencesResponse res = new SaveUserPreferencesResponse();

		UserPreferences userPreferences = ThreadLocals.getSessionContext().getUserPreferences();
		// note: This will be null if session has timed out.
		if (userPreferences == null) {
			return res;
		}

		final String userName = ThreadLocals.getSessionContext().getUserName();

		arun.run(session -> {
			SubNode prefsNode = read.getUserNodeByUserName(session, userName);

			UserPreferences reqUserPrefs = req.getUserPreferences();

			/*
			 * Assign preferences as properties on this node,
			 */
			boolean editMode = reqUserPrefs.isEditMode();
			prefsNode.setProp(NodeProp.USER_PREF_EDIT_MODE.s(), editMode);

			boolean showMetaData = reqUserPrefs.isShowMetaData();
			prefsNode.setProp(NodeProp.USER_PREF_SHOW_METADATA.s(), showMetaData);

			boolean rssHeadingsOnly = reqUserPrefs.isRssHeadlinesOnly();
			prefsNode.setProp(NodeProp.USER_PREF_RSS_HEADINGS_ONLY.s(), rssHeadingsOnly);

			/*
			 * Also update session-scope object, because server-side functions that need preference information
			 * will get it from there instead of loading it from repository. The only time we load user
			 * preferences from repository is during login when we can't get it from anywhere else at that time.
			 */
			userPreferences.setEditMode(editMode);
			userPreferences.setShowMetaData(showMetaData);

			res.setSuccess(true);
			return null;
		});
		return res;
	}

	public SaveUserProfileResponse saveUserProfile(final SaveUserProfileRequest req) {
		SaveUserProfileResponse res = new SaveUserProfileResponse();
		final String userName = ThreadLocals.getSessionContext().getUserName();

		arun.run(session -> {
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
				userNode.setProp(NodeProp.DISPLAY_NAME.s(), req.getDisplayName());
				// sessionContext.setUserName(req.getUserName());
				update.save(session, userNode);
				res.setSuccess(true);
			}
			return null;
		});
		return res;
	}

	public BlockUserResponse blockUser(MongoSession session, final BlockUserRequest req) {
		BlockUserResponse res = new BlockUserResponse();
		final String userName = ThreadLocals.getSessionContext().getUserName();
		session = MongoThreadLocal.ensure(session);

		// get the node that holds all blocked users
		SubNode blockedList =
				read.getUserNodeByType(session, userName, null, null, NodeType.BLOCKED_USERS.s(), null, NodeName.BLOCKED_USERS);

		/*
		 * lookup to see if this will be a duplicate
		 */
		SubNode userNode = read.findNodeByUserAndType(session, blockedList, req.getUserName(), NodeType.FRIEND.s());
		if (userNode == null) {
			String followerActorUrl = null;
			String followerActorHtmlUrl = null;

			userNode = edit.createFriendNode(session, blockedList, req.getUserName(), followerActorUrl, followerActorHtmlUrl);
			if (userNode != null) {
				res.setMessage(
						"Blocked user " + req.getUserName() + ". To manage blocks, go to `Menu -> Users -> Blocked Users`");
			} else {
				res.setMessage("Unable to block user: " + req.getUserName());
			}

			edit.updateSavedFriendNode(userNode);

			res.setSuccess(true);
		} else {
			/*
			 * todo-1: for this AND the friend request (similar places), we need to make it where the user can
			 * never get here or click a button if this is redundant. also we don't yet have in the GUI the
			 * indication of "Follows You" and "[You're] Following" when someone views a user, which is part of
			 * what's needed for this.
			 */
			res.setMessage("You already blocked " + req.getUserName());
			res.setSuccess(true);
		}
		return res;
	}

	/*
	 * Adds 'req.userName' as a friend by creating a FRIEND node under the current user's FRIENDS_LIST
	 * if the user wasn't already a friend
	 */
	public AddFriendResponse addFriend(MongoSession session, final AddFriendRequest req) {
		AddFriendResponse res = new AddFriendResponse();
		final String userName = ThreadLocals.getSessionContext().getUserName();
		session = MongoThreadLocal.ensure(session);

		String _newUserName = req.getUserName();
		_newUserName = XString.stripIfStartsWith(_newUserName, "@");
		final String newUserName = _newUserName;

		// get the Friend List of the follower
		SubNode followerFriendList =
				read.getUserNodeByType(session, userName, null, null, NodeType.FRIEND_LIST.s(), null, NodeName.FRIENDS);

		/*
		 * lookup to see if this followerFriendList node already has userToFollow already under it
		 */
		SubNode friendNode = read.findNodeByUserAndType(session, followerFriendList, newUserName, NodeType.FRIEND.s());
		if (friendNode == null) {
			apService.loadForeignUser(newUserName);

			// todo-2: for local users following fediverse this value needs to be here?
			String followerActorUrl = null;

			// we can definitely put a value here if needed, eventually, even if a non-AP one like
			// '/u/userName/home'
			String followerActorHtmlUrl = null;

			friendNode = edit.createFriendNode(session, followerFriendList, newUserName, //
					followerActorUrl, followerActorHtmlUrl);
					
			if (friendNode != null) {
				ValContainer<SubNode> userNode = new ValContainer<SubNode>();
				arun.run(s -> {
					userNode.setVal(read.getUserNodeByUserName(s, newUserName));
					return null;
				});

				if (userNode.getVal() != null) {
					friendNode.setProp(NodeProp.USER_NODE_ID.s(), userNode.getVal().getId().toHexString());
				}

				res.setMessage("Added new Friend: " + newUserName);
			} else {
				res.setMessage("Unable to add Friend: " + newUserName);
			}

			res.setSuccess(true);
		} else {
			res.setMessage("You're already following " + newUserName);
			res.setSuccess(true);
		}
		return res;
	}

	public GetUserProfileResponse getUserProfile(final GetUserProfileRequest req) {
		GetUserProfileResponse res = new GetUserProfileResponse();
		final String sessionUserName = ThreadLocals.getSessionContext().getUserName();

		arun.run(session -> {
			SubNode userNode = null;

			if (req.getUserId() == null) {
				userNode = read.getUserNodeByUserName(session, sessionUserName);
			} else {
				userNode = read.getNode(session, req.getUserId(), false);
			}

			if (userNode != null) {
				UserProfile userProfile = new UserProfile();

				String nodeUserName = userNode.getStrProp(NodeProp.USER.s());
				String displayName = userNode.getStrProp(NodeProp.DISPLAY_NAME.s());
				SubNode userHomeNode = read.getNodeByName(session, nodeUserName + ":" + NodeName.HOME);

				res.setUserProfile(userProfile);
				userProfile.setUserName(nodeUserName);
				userProfile.setDisplayName(displayName);

				if (userHomeNode != null) {
					userProfile.setHomeNodeId(userHomeNode.getId().toHexString());
				}

				String actorUrl = userNode.getStrProp(NodeProp.ACT_PUB_ACTOR_URL);

				userProfile.setUserBio(userNode.getStrProp(NodeProp.USER_BIO.s()));
				userProfile.setAvatarVer(userNode.getStrProp(NodeProp.BIN.s()));
				userProfile.setHeaderImageVer(userNode.getStrProp(NodeProp.BIN.s() + "Header"));
				userProfile.setUserNodeId(userNode.getId().toHexString());
				userProfile.setApIconUrl(userNode.getStrProp(NodeProp.ACT_PUB_USER_ICON_URL));
				userProfile.setApImageUrl(userNode.getStrProp(NodeProp.ACT_PUB_USER_IMAGE_URL));
				userProfile.setActorUrl(actorUrl);

				Long followerCount = apFollower.countFollowersOfUser(session, nodeUserName, actorUrl);
				userProfile.setFollowerCount(followerCount.intValue());

				Long followingCount = apFollowing.countFollowingOfUser(session, nodeUserName, actorUrl);
				userProfile.setFollowingCount(followingCount.intValue());

				if (!ThreadLocals.getSessionContext().isAnonUser()) {
					/*
					 * Only for local users do we attemp to generate followers and following, but theoretically we can
					 * use the ActPub API to query for this for foreign users also.
					 */
					boolean blocked = userIsBlockedByMe(session, nodeUserName);
					userProfile.setBlocked(blocked);

					boolean following = userIsFollowedByMe(session, nodeUserName);
					userProfile.setFollowing(following);
				}

				// todo-1: add ability to know "follows you" state (for display on UserProfileDlg)
				res.setSuccess(true);
			}
			return null;
		});
		return res;
	}

	public boolean userIsFollowedByMe(MongoSession session, String maybeFollowedUser) {
		final String userName = ThreadLocals.getSessionContext().getUserName();
		SubNode friendsList =
				read.getUserNodeByType(session, userName, null, null, NodeType.FRIEND_LIST.s(), null, NodeName.BLOCKED_USERS);
		SubNode userNode = read.findNodeByUserAndType(session, friendsList, maybeFollowedUser, NodeType.FRIEND.s());
		return userNode != null;
	}

	public boolean userIsBlockedByMe(MongoSession session, String maybeBlockedUser) {
		final String userName = ThreadLocals.getSessionContext().getUserName();
		SubNode blockedList =
				read.getUserNodeByType(session, userName, null, null, NodeType.BLOCKED_USERS.s(), null, NodeName.BLOCKED_USERS);
		SubNode userNode = read.findNodeByUserAndType(session, blockedList, maybeBlockedUser, NodeType.FRIEND.s());
		return userNode != null;
	}

	public UserPreferences getDefaultUserPreferences() {
		UserPreferences userPrefs = new UserPreferences();
		userPrefs.setShowMetaData(true);
		return userPrefs;
	}

	public UserPreferences getUserPreferences(String userName, SubNode _prefsNode) {
		final UserPreferences userPrefs = new UserPreferences();

		arun.run(session -> {
			SubNode prefsNode = _prefsNode;
			if (prefsNode == null) {
				prefsNode = read.getUserNodeByUserName(session, userName);
			}
			userPrefs.setEditMode(prefsNode.getBooleanProp(NodeProp.USER_PREF_EDIT_MODE.s()));
			userPrefs.setShowMetaData(prefsNode.getBooleanProp(NodeProp.USER_PREF_SHOW_METADATA.s()));
			userPrefs.setRssHeadlinesOnly(prefsNode.getBooleanProp(NodeProp.USER_PREF_RSS_HEADINGS_ONLY.s()));

			long maxFileSize = prefsNode.getIntProp(NodeProp.BIN_QUOTA.s());
			if (maxFileSize == 0) {
				maxFileSize = Const.DEFAULT_USER_QUOTA;
			}
			userPrefs.setMaxUploadFileSize(maxFileSize);
			return null;
		});

		return userPrefs;
	}

	/*
	 * Runs when user is doing the 'change password' or 'reset password'
	 */
	public ChangePasswordResponse changePassword(MongoSession session, final ChangePasswordRequest req) {
		ChangePasswordResponse res = new ChangePasswordResponse();
		session = MongoThreadLocal.ensure(session);

		ValContainer<SubNode> userNode = new ValContainer<>();
		ValContainer<String> userName = new ValContainer<>();

		String passCode = req.getPassCode();
		if (passCode != null) {
			/*
			 * We can run this block as admin, because the codePart below is secret and is checked for a match
			 */
			arun.run(mongoSession -> {

				String userNodeId = XString.truncateAfterFirst(passCode, "-");

				if (userNodeId == null) {
					throw new RuntimeEx("Unable to find userNodeId: " + userNodeId);
				}
				userNode.setVal(read.getNode(mongoSession, userNodeId));

				if (userNode.getVal() == null) {
					throw ExUtil.wrapEx("Invald password reset code.");
				}

				String codePart = XString.parseAfterLast(passCode, "-");

				String nodeCodePart = userNode.getVal().getStrProp(NodeProp.USER_PREF_PASSWORD_RESET_AUTHCODE.s());
				if (!codePart.equals(nodeCodePart)) {
					throw ExUtil.wrapEx("Invald password reset code.");
				}

				String password = req.getNewPassword();
				userName.setVal(userNode.getVal().getStrProp(NodeProp.USER.s()));

				if (PrincipalName.ADMIN.s().equals(userName.getVal())) {
					throw new RuntimeEx("changePassword should not be called fror admin user.");
				}

				userNode.getVal().setProp(NodeProp.PWD_HASH.s(), util.getHashOfPassword(password));
				userNode.getVal().deleteProp(NodeProp.USER_PREF_PASSWORD_RESET_AUTHCODE.s());

				// note: the adminRunner.run saves the session so we don't do that here.
				return null;
			});
		} else {
			userNode.setVal(read.getUserNodeByUserName(session, session.getUserName()));

			if (userNode.getVal() == null) {
				throw ExUtil.wrapEx("changePassword cannot find user.");
			}

			if (PrincipalName.ADMIN.s().equals(userName.getVal())) {
				throw new RuntimeEx("changePassword should not be called fror admin user.");
			}

			String password = req.getNewPassword();
			userName.setVal(userNode.getVal().getStrProp(NodeProp.USER.s()));
			userNode.getVal().setProp(NodeProp.PWD_HASH.s(), util.getHashOfPassword(password));
			userNode.getVal().deleteProp(NodeProp.USER_PREF_PASSWORD_RESET_AUTHCODE.s());

			update.save(session, userNode.getVal());
		}

		res.setUser(userName.getVal());
		res.setSuccess(true);
		return res;
	}

	public boolean isNormalUserName(String userName) {
		userName = userName.trim();
		return !userName.equalsIgnoreCase(PrincipalName.ADMIN.s()) && !userName.equalsIgnoreCase(PrincipalName.ANON.s());
	}

	public ResetPasswordResponse resetPassword(final ResetPasswordRequest req) {
		ResetPasswordResponse res = new ResetPasswordResponse();
		arun.run(session -> {

			String user = req.getUser();
			String email = req.getEmail();

			/* make sure username itself is acceptalbe */
			if (!isNormalUserName(user)) {
				res.setMessage("User name is illegal.");
				res.setSuccess(false);
				return null;
			}

			SubNode ownerNode = read.getUserNodeByUserName(session, user);
			if (ownerNode == null) {
				res.setMessage("User does not exist.");
				res.setSuccess(false);
				return null;
			}

			/*
			 * IMPORTANT!
			 *
			 * verify that the email address provides IS A MATCH to the email address for this user! Important
			 * step here because without this check anyone would be able to completely hijack anyone else's
			 * account simply by issuing a password change to that account!
			 */
			String nodeEmail = ownerNode.getStrProp(NodeProp.EMAIL.s());
			if (nodeEmail == null || !nodeEmail.equals(email)) {
				res.setMessage("Wrong user name and/or email.");
				res.setSuccess(false);
				return null;
			}

			/*
			 * if we make it to here the user and email are both correct, and we can initiate the password
			 * reset. We pick some random time between 1 and 2 days from now into the future to serve as the
			 * unguessable auth code AND the expire time for it. Later we can create a deamon processor that
			 * cleans up expired authCodes, but for now we just need to HAVE the auth code.
			 *
			 * User will be emailed this code and we will perform reset when we see it, and the user has entered
			 * new password we can use.
			 */
			int oneDayMillis = 60 * 60 * 1000;
			long authCode = new Date().getTime() + oneDayMillis + rand.nextInt(oneDayMillis);

			ownerNode.setProp(NodeProp.USER_PREF_PASSWORD_RESET_AUTHCODE.s(), String.valueOf(authCode));
			update.save(session, ownerNode);

			String passCode = ownerNode.getId().toHexString() + "-" + String.valueOf(authCode);
			String link = appProp.getHostAndPort() + "/app?passCode=" + passCode;

			String brandingAppName = appProp.getConfigText("brandingAppName");

			String content = "Password reset was requested on " + brandingAppName + " account: " + user + //
			"<p>\nGo to this link to reset your password: <br>\n" + link;

			outboxMgr.queueEmail(email, brandingAppName + " Password Reset", content);

			res.setMessage("A password reset link has been sent to your email. Check your email in a minute or so.");
			res.setSuccess(true);
			return null;
		});
		return res;
	}

	public GetFriendsResponse getFriends(MongoSession session) {
		GetFriendsResponse res = new GetFriendsResponse();

		List<SubNode> friendNodes = getSpecialNodesList(session, NodeType.FRIEND_LIST.s());

		if (friendNodes != null) {
			List<FriendInfo> friends = new LinkedList<>();

			for (SubNode friendNode : friendNodes) {
				String userName = friendNode.getStrProp(NodeProp.USER.s());
				if (userName != null) {
					FriendInfo fi = new FriendInfo();
					fi.setUserName(userName);

					SubNode userNode = read.getUserNodeByUserName(null, userName);
					if (userNode != null) {
						fi.setDisplayName(userNode.getStrProp(NodeProp.DISPLAY_NAME.s()));
					}

					String userNodeId = friendNode.getStrProp(NodeProp.USER_NODE_ID);

					SubNode friendAccountNode = read.getNode(session, userNodeId, false);
					if (friendAccountNode != null) {
						fi.setAvatarVer(friendAccountNode.getStrProp(NodeProp.BIN));
					}
					fi.setUserNodeId(userNodeId);
					friends.add(fi);
				}
			}

			res.setFriends(friends);
		}
		res.setSuccess(true);
		return res;
	}

	/**
	 * Looks in the user's account under their 'underType' type node and returns all the children.
	 */
	public List<SubNode> getSpecialNodesList(MongoSession session, String underType) {
		session = MongoThreadLocal.ensure(session);
		List<SubNode> nodeList = new LinkedList<>();
		SubNode userNode = read.getUserNodeByUserName(session, null);
		if (userNode == null)
			return null;

		SubNode parentNode = read.findTypedNodeUnderPath(session, userNode.getPath(), underType);
		if (parentNode == null)
			return null;

		for (SubNode friendNode : read.getChildren(session, parentNode, Sort.by(Sort.Direction.ASC, SubNode.FIELD_ORDINAL), null,
				0)) {
			nodeList.add(friendNode);
		}
		return nodeList;
	}

	/*
	 * For all foreign servers we remove posts that are older than a certain number of days just to keep
	 * our DB from growing too large.
	 * 
	 * todo-1: Is this a dupliate of "ActPub Maintenance" menu option logic?
	 */
	public void cleanUserAccounts() {
		// not currently used.
		if (true)
			return;

		// adminRunner.run(session -> {
		// final Iterable<SubNode> accountNodes =
		// read.getChildrenUnderParentPath(session, NodeName.ROOT_OF_ALL_USERS, null, null, 0, null, null);

		// for (final SubNode accountNode : accountNodes) {
		// String userName = accountNode.getStrProp(NodeProp.USER);

		// // if account is a 'foreign server' one, then clean it up
		// if (userName != null) {
		// log.debug("userName: " + userName);

		// if (userName.contains("@")) {
		// log.debug("Foreign Accnt Kill: " + userName);
		// delete.delete(accountNode);

		// // delete.cleanupOldTempNodesForUser(session, accountNode);
		// }
		// }
		// }

		// apCache.usersPendingRefresh.clear();
		// });
	}

	public String getUserAccountsReport(MongoSession session) {
		session = MongoThreadLocal.ensure(session);
		int localUserCount = 0;
		int foreignUserCount = 0;

		StringBuilder sb = new StringBuilder();
		final Iterable<SubNode> accountNodes =
				read.getChildrenUnderParentPath(session, NodeName.ROOT_OF_ALL_USERS, null, null, 0, null, null);

		for (final SubNode accountNode : accountNodes) {
			String userName = accountNode.getStrProp(NodeProp.USER);
			if (userName != null) {
				// if account is a 'foreign server' one, then clean it up
				if (userName.contains("@")) {
					foreignUserCount++;
				} else {
					localUserCount++;
				}
			}
		}
		sb.append("Local User Count: " + localUserCount + "\n");
		sb.append("Foreign User Count: " + foreignUserCount + "\n");
		return sb.toString();
	}

	public void updateLastActiveTime(SessionContext sc) {
		MongoSession session = auth.getAdminSession();
		SubNode userNode = read.getUserNodeByUserName(session, sc.getUserName());
		if (userNode != null) {
			userNode.setProp(NodeProp.LAST_ACTIVE_TIME.s(), sc.getLastActiveTime());
			update.save(session, userNode);
		}
	}

	public int getMaxUploadSize(MongoSession session) {
		if (session.isAnon()) {
			return 0;
		}
		if (session.isAdmin()) {
			return Integer.MAX_VALUE;
		}

		SubNode userNode = read.getUserNodeByUserName(auth.getAdminSession(), sc.getUserName());
		long ret = userNode.getIntProp(NodeProp.BIN_QUOTA.s());
		if (ret == 0) {
			return Const.DEFAULT_USER_QUOTA;
		}
		return (int) ret;
	}
}
