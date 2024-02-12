package quanta.service;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Random;
import java.util.StringTokenizer;
import java.util.concurrent.ConcurrentHashMap;
import org.apache.commons.lang3.StringUtils;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import quanta.config.ServiceBase;
import quanta.config.SessionContext;
import quanta.exception.OutOfSpaceException;
import quanta.exception.UnauthorizedException;
import quanta.exception.base.RuntimeEx;
import quanta.model.UserPreferences;
import quanta.model.UserStats;
import quanta.model.client.Attachment;
import quanta.model.client.Constant;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.model.client.PrincipalName;
import quanta.model.client.PrivilegeType;
import quanta.model.client.UserProfile;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.postgres.table.Tran;
import quanta.postgres.table.UserAccount;
import quanta.request.BlockUserRequest;
import quanta.request.ChangePasswordRequest;
import quanta.request.CloseAccountRequest;
import quanta.request.DeleteUserTransactionsRequest;
import quanta.request.GetPeopleRequest;
import quanta.request.GetUserAccountInfoRequest;
import quanta.request.GetUserProfileRequest;
import quanta.request.LoginRequest;
import quanta.request.ResetPasswordRequest;
import quanta.request.SaveUserPreferencesRequest;
import quanta.request.SaveUserProfileRequest;
import quanta.request.SignupRequest;
import quanta.response.AddCreditResponse;
import quanta.response.BlockUserResponse;
import quanta.response.ChangePasswordResponse;
import quanta.response.CloseAccountResponse;
import quanta.response.DeleteUserTransactionsResponse;
import quanta.response.FriendInfo;
import quanta.response.GetPeopleResponse;
import quanta.response.GetUserAccountInfoResponse;
import quanta.response.GetUserProfileResponse;
import quanta.response.LoginResponse;
import quanta.response.LogoutResponse;
import quanta.response.ResetPasswordResponse;
import quanta.response.SaveUserPreferencesResponse;
import quanta.response.SaveUserProfileResponse;
import quanta.response.SignupResponse;
import quanta.response.UpdateAccountInfo;
import quanta.util.Const;
import quanta.util.DateUtil;
import quanta.util.ExUtil;
import quanta.util.ThreadLocals;
import quanta.util.Util;
import quanta.util.XString;
import quanta.util.val.Val;

/**
 * Service methods for processing user management functions. Login, logout, signup, user
 * preferences, and settings persisted per-user
 */
@Component
public class UserManagerService extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(UserManagerService.class);

    private static final Random rand = new Random();
    public static final float INITIAL_GRANT_AMOUNT = 0.01f;

    /* Private keys of each user by user name as key */
    public static final ConcurrentHashMap<String, String> privateKeysByUserName = new ConcurrentHashMap<>();

    public static final ConcurrentHashMap<String, SseEmitter> pushEmitters = new ConcurrentHashMap<>();

    public SseEmitter getPushEmitter(String token) {
        SseEmitter emitter = pushEmitters.get(token);
        if (emitter == null) {
            // big number here so we never timeout
            emitter = new SseEmitter(Long.MAX_VALUE);

            // emitter.onCompletion(() -> log.debug("SseEmitter is completed"));
            emitter.onTimeout(() -> log.debug("SseEmitter is timed out"));
            emitter.onError((ex) -> log.debug("SseEmitter got error:", ex));

            pushEmitters.put(token, emitter);
            log.debug("SseEmitter token " + token + " on replica " + prop.getSwarmTaskSlot());
        }
        return emitter;
    }

    // DO NOT DELETE (yet)
    // emitter.complete() is called below.
    // public static void sessionDestroyed(HttpSession session) {
    // String token = (String) session.getAttribute(Const.BEARER_TOKEN);
    // if (token != null) {
    // removePushEmitter(token);
    // }
    // }
    // public static void removePushEmitter(String token) {
    // SseEmitter emitter = UserManagerService.pushEmitters.get(token);
    // // if we happened to be the right replica to push to browser, then push
    // if (emitter != null) {
    // log.debug("removePushEmitter doing nothing.");
    // // log.debug("Closing Emitter for UserToken " + token);
    // emitter.complete();
    // log.debug("called emitter.complete");
    // // UserManagerService.pushEmitters.remove(token);
    // }
    // }

    // todo-a: I think this function AND "reqBearerToken" (not bearerToken) can be factored out for a
    // more consistent design letting all the logic be only in AppFilter
    public void authBearer() {
        SessionContext sc = ThreadLocals.getSC();
        if (sc == null) {
            throw new RuntimeException("Unable to get SessionContext to check token.");
        }
        String bearer = ThreadLocals.getReqBearerToken();
        // otherwise require secure header
        if (bearer == null || !validToken(bearer, sc.getUserName())) {
            throw new UnauthorizedException();
        }
    }

    /*
     * We rely on the secrecy and unguessability of the token here, but eventually this will become JWT
     * and perhaps use Spring Security.
     *
     * useName can be null, in which case we only validate the token exists.
     */
    public boolean validToken(String token, String userName) {
        if (StringUtils.isEmpty(token))
            return false;

        SessionContext sc = redis.get(token);
        return sc != null && (userName == null || sc.getUserName().equals(userName));
    }

    /*
     * Note that this function does 'succeed' even with ANON user given, and just considers that an
     * anonymouse user
     */
    public LoginResponse login(HttpServletRequest httpReq, LoginRequest req) {
        LoginResponse res = new LoginResponse();
        SessionContext sc = ThreadLocals.getSC();
        Val<SubNode> userNodeVal = new Val<>();

        // Anonymous user
        if (req.getUserName() == null || PrincipalName.ANON.s().equals(req.getUserName())) {
            log.debug("Anonymous user login.");
            // just as a precaution update the sc userName to anon values
            sc.setUserName(PrincipalName.ANON.s());
            sc.setUserNodeId(null);
        }
        // Admin Login
        else if (PrincipalName.ADMIN.s().equalsIgnoreCase(req.getUserName().trim())) {
            if (!prop.getAdminPassword().equals(req.getPassword())) {
                throw new RuntimeException("Unauthorized");
            }

            arun.run(as -> {
                SubNode userNode = read.getAccountByUserName(as, req.getUserName(), false);
                if (userNode == null) {
                    throw new RuntimeException("User not found: " + req.getUserName());
                }
                userNodeVal.setVal(userNode);
                setAuthenticated(sc, req.getUserName(), userNode.getId());
                return null;
            });
        }
        // User Login
        else {
            // lookup userNode to get the ACTUAL (case sensitive) userName to put in sesssion.
            arun.run(as -> {
                SubNode userNode = read.getAccountByUserName(as, req.getUserName(), false);
                if (userNode == null) {
                    throw new RuntimeException("User not found: " + req.getUserName());
                }
                userNodeVal.setVal(userNode);
                String userName = userNode.getStr(NodeProp.USER);
                String checkHash = userNode.getStr(NodeProp.PWD_HASH);
                String reqHash = mongoUtil.getHashOfPassword(req.getPassword());
                if (!checkHash.equals(reqHash)) {
                    throw new RuntimeException("Unauthorized");
                }
                setAuthenticated(sc, userName, userNode.getId());
                return null;
            });
        }
        // If we reach here we either have ANON user or some authenticated user (password checked ok)
        ThreadLocals.initMongoSession(sc);
        // We have to get timezone information from the user's browser, so that all times on all nodes
        // always show up in their precise local time!
        sc.setTimezone(DateUtil.getTimezoneFromOffset(req.getTzOffset()));
        sc.setTimeZoneAbbrev(DateUtil.getUSTimezone(-req.getTzOffset() / 60, req.getDst()));
        res.setAnonUserLandingPageNode(prop.getUserLandingPageNode());
        if (sc.getUserToken() != null) {
            MongoSession ms = ThreadLocals.getMongoSession();
            processLogin(ms, res, userNodeVal.getVal(), sc.getUserName(), req.getAsymEncKey(), req.getSigKey());
            log.debug("login: user=" + sc.getUserName());
        } else {
            res.setUserPreferences(getDefaultUserPreferences());
        }
        return res;
    }

    /* This is called only upon successful login of a non-anon user */
    public void setAuthenticated(SessionContext sc, String userName, ObjectId userNodeId) {
        if (userName.equals(PrincipalName.ANON.s())) {
            throw new RuntimeException("invalid call to setAuthenticated for anon.");
        }

        // only generate a token if not already set, because this SessionContext is shared across
        // the swarm replicas via redis
        if (sc.getUserToken() == null) {
            sc.setUserToken(Util.genStrongToken());
            // log.debug("userName: " + userName + " NEW userToken: " + sc.getUserToken() + " sessionId="
            // + ThreadLocals.getHttpSession().getId());
        }
        sc.setUserName(userName);
        sc.setUserNodeId(userNodeId.toHexString());
    }

    public SubNode getNotesNode(MongoSession ms, String userName, SubNode userNode) {
        return read.getUserNodeByType(ms, userName, userNode, "### Notes", NodeType.NOTES.s(),
                Arrays.asList(PrivilegeType.READ.s()), true);
    }

    public SubNode getPostsNode(MongoSession ms, String userName, SubNode userNode) {
        return read.getUserNodeByType(ms, userName, userNode, "### Posts", NodeType.POSTS.s(),
                Arrays.asList(PrivilegeType.READ.s()), true);
    }

    public SubNode getFriendsList(MongoSession ms, String userName, boolean create) {
        return read.getUserNodeByType(ms, userName, null, "### Friends List", NodeType.FRIEND_LIST.s(), null, create);
    }

    public SubNode getBlockedUsers(MongoSession ms, String userName, boolean create) {
        return read.getUserNodeByType(ms, userName, null, "### Blocked Users", NodeType.BLOCKED_USERS.s(), null,
                create);
    }

    /*
     * caller can optionally pass userNode if it's already available, or else it will be looked up using
     * userName
     */
    public void processLogin(MongoSession ms, LoginResponse res, SubNode userNode, String userName, String asymEncKey,
            String sigKey) {
        SessionContext sc = ThreadLocals.getSC();
        if (userNode == null) {
            userNode = read.getAccountByUserName(null, userName, false);
        }
        if (userNode == null) {
            throw new RuntimeEx("User not found: " + userName);
        }
        String id = userNode.getIdStr();
        if (id == null) {
            throw new RuntimeException("userNode id is null for user: " + userName);
        }
        sc.setUserNodeId(id);
        sc.setAllowedFeatures(userNode.getStr(NodeProp.ALLOWED_FEATURES));
        res.setAllowedFeatures(sc.getAllowedFeatures());
        UserPreferences userPreferences = getUserPreferences(userName, userNode);
        sc.setUserPreferences(userPreferences);
        res.setRootNodePath(userNode.getPath());
        res.setAllowFileSystemSearch(prop.isAllowFileSystemSearch());
        res.setUserPreferences(userPreferences);
        res.setAuthToken(sc.getUserToken());
        Date now = new Date();
        sc.setLastLoginTime(now.getTime());
        userNode.set(NodeProp.LAST_LOGIN_TIME, now.getTime());
        if (!StringUtils.isEmpty(asymEncKey))
            userNode.setIfNotExist(NodeProp.USER_PREF_PUBLIC_KEY, asymEncKey);
        if (!StringUtils.isEmpty(sigKey))
            userNode.setIfNotExist(NodeProp.USER_PREF_PUBLIC_SIG_KEY, sigKey);
        ThreadLocals.getSC().setPubSigKeyJson(null);
        res.setUserProfile(user.getUserProfile(userNode.getIdStr(), userNode, true));
        crypto.ensureValidCryptoKeys(userNode);

        @SuppressWarnings("unused")
        SubNode notesNode = user.getNotesNode(ms, userName, userNode);
        update.save(ms, userNode);
    }

    public CloseAccountResponse closeAccount(CloseAccountRequest req, HttpSession session) {
        CloseAccountResponse res = new CloseAccountResponse();
        log.debug("Closing Account: " + ThreadLocals.getSC().getUserName());
        arun.run(as -> {
            String userName = ThreadLocals.getSC().getUserName();
            SubNode ownerNode = read.getAccountByUserName(as, userName, false);
            if (ownerNode != null) {
                delete.delete(as, ownerNode, false);
            }
            return null;
        });
        session.invalidate();
        return res;
    }

    /**
     * 'userStats' Holds a map of User Root Node (account node) IDs as key mapped to the UserStats for
     * that user.
     */
    public void writeUserStats(MongoSession ms, HashMap<ObjectId, UserStats> userStats) {
        userStats.forEach((ObjectId key, UserStats stat) -> {
            SubNode node = read.getNode(ms, key);
            if (node != null) {
                node.set(NodeProp.BIN_TOTAL, stat.binUsage);
            } else {
                log.debug("Node not found by key: " + key);
            }
        });
    }

    /*
     * We have 'sign' so we can use this method to either deduct from or add to the user's total usage
     * amount
     */
    public void addBytesToUserNodeBytes(MongoSession ms, long binSize, SubNode userNode) {
        if (userNode == null) {
            userNode = read.getAccountByUserName(null, null, false);
        }
        // get the current binTotal on the user account (max they are allowed to upload)
        Long binTotal = userNode.getInt(NodeProp.BIN_TOTAL);
        if (binTotal == null) {
            binTotal = 0L;
        }
        binTotal += binSize;
        if (binTotal < 0) {
            binTotal = 0L;
        }
        Long userQuota = userNode.getInt(NodeProp.BIN_QUOTA);
        if (!ms.isAdmin() && binTotal > userQuota) {
            throw new OutOfSpaceException();
        }
        userNode.set(NodeProp.BIN_TOTAL, binTotal);
    }

    /*
     * Processes last step of signup, which is validation of registration code. This means user has
     * clicked the link they were sent during the signup email verification, and they are sending in a
     * signupCode that will turn on their account and actually create their account.
     *
     * We return whatever a message would be to the user that just says if the signupCode was accepted
     * or not and it's displayed on welcome.html only.
     */
    public String processSignupCode(String signupCode) {
        log.debug("User is trying signupCode: " + signupCode);
        return arun.run(as -> {
            // signupCode is just the new account node id? I guess that's secure, if user
            // has this value it's the only user who could possibly know this unguessable value.
            SubNode node = read.getNode(as, signupCode);
            if (node != null) {
                if (!node.getBool(NodeProp.SIGNUP_PENDING)) {
                    return "Signup Complete. You may login now.";
                } else {
                    String userName = node.getStr(NodeProp.USER);
                    if (PrincipalName.ADMIN.s().equalsIgnoreCase(userName)) {
                        return "processSignupCode should not be called for admin user.";
                    } else {
                        node.delete(NodeProp.SIGNUP_PENDING);
                        update.save(as, node);
                        return "Signup Successful. You may login now.";
                    }
                }
            } else {
                return "Signup Code is invalid.";
            }
        });
    }

    public void initNewUser(MongoSession ms, String userName, String password, String email, boolean automated) {
        SubNode userNode = mongoUtil.createUser(ms, userName, email, password, automated, null, false);
        if (userNode != null) {
            log.debug("Successful signup complete.");
        }
    }

    public List<String> getOwnerNames(SubNode node) {
        Val<List<String>> ret = new Val<List<String>>();
        arun.run(as -> {
            ret.setVal(acl.getOwnerNames(as, node));
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
        res.setCode(HttpServletResponse.SC_OK);
        arun.run(as -> {
            String userName = req.getUserName().trim();
            String password = req.getPassword().trim();
            String email = req.getEmail().trim();
            log.debug("Signup: userName=" + userName + " email=" + email);

            String userError = validator.checkUserName(userName);
            if (userError != null) {
                res.setUserError(userError);
                res.setCode(HttpServletResponse.SC_EXPECTATION_FAILED);
            }
            String passwordError = validator.checkPassword(password);
            if (passwordError != null) {
                res.setPasswordError(passwordError);
                res.setCode(HttpServletResponse.SC_EXPECTATION_FAILED);
            }
            String emailError = validator.checkEmail(email);
            if (emailError != null) {
                res.setEmailError(emailError);
                res.setCode(HttpServletResponse.SC_EXPECTATION_FAILED);
            }

            // we disallow dupliate emails via this codepath, but by design we do allow them in the DB, and
            // even all the 'test accounts' will normally have the same email address.
            SubNode ownerNode = read.getLocalUserNodeByProp(as, NodeProp.EMAIL.s(), email, false, false);
            if (ownerNode != null) {
                res.setEmailError("Email already in use.");
                res.setCode(HttpServletResponse.SC_EXPECTATION_FAILED);
            }

            if (!automated) {
                String captcha = (String) ThreadLocals.getHttpSession().getAttribute("captcha");
                if (!captcha.equals(req.getCaptcha())) {
                    Util.sleep(3000);
                    res.setCaptchaError("Wrong captcha. Try again.");
                    res.setCode(HttpServletResponse.SC_EXPECTATION_FAILED);
                }

                if (res.getCode() == null || res.getCode() != HttpServletResponse.SC_OK) {
                    return res;
                }
                initiateSignup(as, userName, password, email);
            } else {
                initNewUser(as, userName, password, email, automated);
            }
            return null;
        });
        return res;
    }

    /*
     * Adds user to the list of pending accounts and they will stay in pending status until their
     * signupCode has been used to validate their email address.
     */
    public void initiateSignup(MongoSession ms, String userName, String password, String email) {
        SubNode ownerNode = read.getAccountByUserName(ms, userName, false);
        if (ownerNode != null) {
            throw new RuntimeEx("User already exists.");
        }
        SubNode newUserNode = mongoUtil.createUser(ms, userName, email, password, false, null, false);
        // It's easiest to use the actua new UserNode ID as the 'signup code' to send to the user, because
        // it's random and tied to this user by definition
        String signupCode = newUserNode.getIdStr();
        String signupLink = prop.getHttpProtocol() + "://" + prop.getMetaHost() + "?signupCode=" + signupCode;
        String content = null;
        // We print this out so we can use it in DEV mode when no email support may be configured
        log.debug("Signup URL: " + signupLink);
        String brandingAppName = prop.getConfigText("brandingAppName");
        content = "Welcome to " + brandingAppName + ", " + userName + "!"
                + "<p>\nUse this link to complete the signup: <br>\n" + signupLink;
        if (!StringUtils.isEmpty(prop.getMailHost())) {
            outbox.queueEmail(email, brandingAppName + " - Account Signup", content);
        }
    }

    public void setDefaultUserPreferences(SubNode prefsNode) {
        prefsNode.set(NodeProp.USER_PREF_EDIT_MODE, false);
        prefsNode.set(NodeProp.USER_PREF_RSS_HEADINGS_ONLY, true);
    }

    public GetUserAccountInfoResponse getUserAccountInfo(GetUserAccountInfoRequest req) {
        GetUserAccountInfoResponse res = new GetUserAccountInfoResponse();
        String userName = ThreadLocals.getSC().getUserName();
        arun.run(as -> {
            SubNode userNode = read.getAccountByUserName(as, userName, false);
            if (userNode == null) {
                res.error("unknown user: " + userName);
            }
            try {
                // foreign users won't have these.
                Long binQuota = userNode.getInt(NodeProp.BIN_QUOTA);
                Long binTotal = userNode.getInt(NodeProp.BIN_TOTAL);
                // I really need to convert these props to Integers not Strings
                res.setBinQuota(binQuota == null ? -1 : binQuota.intValue());
                res.setBinTotal(binTotal == null ? -1 : binTotal.intValue());
            } catch (Exception e) {
            }
            return null;
        });
        return res;
    }

    public boolean initialGrant(String userId, String userName) {
        UserAccount user = userRepository.findByMongoId(userId);
        if (user == null) {
            log.debug("UserAccount not found, creating...");
            user = userRepository.save(new UserAccount(userId, userName));

            Tran credit = new Tran();
            credit.setAmt(new BigDecimal(INITIAL_GRANT_AMOUNT));
            credit.setTransType("C");
            credit.setDescCode("NEW");
            credit.setTs(Timestamp.from(Instant.now()));
            credit.setUserAccount(user);
            tranRepository.save(credit);
            return true;
        }
        return false;
    }

    public DeleteUserTransactionsResponse deleteUserTransactions(MongoSession as, DeleteUserTransactionsRequest req) {
        ThreadLocals.requireAdmin();
        DeleteUserTransactionsResponse res = new DeleteUserTransactionsResponse();
        userRepository.deleteByMongoId(req.getUserId());
        return res;
    }

    public AddCreditResponse addCredit(MongoSession as, String userId, BigDecimal amount) {
        ThreadLocals.requireAdmin();
        AddCreditResponse res = new AddCreditResponse();
        addCreditInternal(as, userId, amount, null);

        // calculate new balance and return it.
        res.setBalance(tranRepository.getBalByMongoId(userId));
        return res;
    }

    public void addCreditByEmail(MongoSession as, String email, BigDecimal amount, Long timestamp) {
        SubNode ownerNode = read.getLocalUserNodeByProp(as, NodeProp.EMAIL.s(), email, false, false);
        if (ownerNode != null) {
            String userName = ownerNode.getStr(NodeProp.USER);
            addCreditInternal(as, ownerNode.getIdStr(), amount, timestamp);

            if (!StringUtils.isEmpty(prop.getMailHost())) {
                String brandingAppName = prop.getConfigText("brandingAppName");
                String content = "Thanks for using " + brandingAppName + ", " + userName + "!" + "<p>\nA payment of $"
                        + amount + " has been applied to your account.";

                outbox.queueEmail(email, brandingAppName + " - Account Credit", content);
            }

            BigDecimal credit = tranRepository.getBalByMongoId(ownerNode.getIdStr());
            UpdateAccountInfo pushInfo = new UpdateAccountInfo(ownerNode.getIdStr(), credit);
            push.pushInfo(ThreadLocals.getSC(), pushInfo);
        } else {
            log.debug("addCreditByEmail: user not found for email: " + email);
        }
    }

    private void addCreditInternal(MongoSession as, String userId, BigDecimal amount, Long timestamp) {
        UserAccount user = userRepository.findByMongoId(userId);
        if (user == null) {
            log.debug("User not found, creating...");
            SubNode userNode = read.getNode(as, userId, true, null);
            String userName = userNode.getStr(NodeProp.USER);
            user = userRepository.save(new UserAccount(userId, userName));
        }

        Tran credit = new Tran();
        credit.setAmt(amount);
        credit.setTransType("C");
        credit.setDescCode("PAY");
        if (timestamp == null) {
            credit.setTs(Timestamp.from(Instant.now()));
        } else {
            credit.setTs(new Timestamp(timestamp));
        }
        credit.setUserAccount(user);
        tranRepository.save(credit);
        log.debug("TRAN: " + XString.prettyPrint(credit));
    }

    public SaveUserPreferencesResponse saveUserPreferences(SaveUserPreferencesRequest req) {
        SaveUserPreferencesResponse res = new SaveUserPreferencesResponse();
        UserPreferences userPrefs = ThreadLocals.getSC().getUserPreferences();
        // note: This will be null if session has timed out.
        if (userPrefs == null) {
            return res;
        }
        UserPreferences reqUserPrefs = req.getUserPreferences();
        // once triggered it stays on (for now)
        if (reqUserPrefs.isEnableIPSM()) {
            ThreadLocals.getSC().setEnableIPSM(true);
        }
        arun.run(as -> {
            SubNode prefsNode = read.getNode(as, req.getUserNodeId());
            if (prefsNode == null)
                throw new RuntimeException("Unable to update preferences.");
            // Make sure the account node we're about to modify does belong to the current user.
            if (!ThreadLocals.getSC().getUserName().equals(prefsNode.getStr(NodeProp.USER))) {
                throw new RuntimeException("Not your node.");
            }
            // Assign preferences as properties on this node,
            prefsNode.set(NodeProp.USER_PREF_EDIT_MODE, reqUserPrefs.isEditMode());
            prefsNode.set(NodeProp.USER_PREF_SHOW_METADATA, reqUserPrefs.isShowMetaData());
            prefsNode.set(NodeProp.USER_PREF_SHOW_PROPS, reqUserPrefs.isShowProps());
            prefsNode.set(NodeProp.USER_PREF_AUTO_REFRESH_FEED, reqUserPrefs.isAutoRefreshFeed()); // #add-prop
            prefsNode.set(NodeProp.USER_PREF_SHOW_REPLIES, reqUserPrefs.isShowReplies());
            prefsNode.set(NodeProp.USER_PREF_RSS_HEADINGS_ONLY, reqUserPrefs.isRssHeadlinesOnly());
            prefsNode.set(NodeProp.USER_PREF_MAIN_PANEL_COLS, reqUserPrefs.getMainPanelCols());
            prefsNode.set(NodeProp.USER_PREF_AI_SERVICE, reqUserPrefs.getAiService());

            userPrefs.setEditMode(reqUserPrefs.isEditMode());
            userPrefs.setShowMetaData(reqUserPrefs.isShowMetaData());
            userPrefs.setShowProps(reqUserPrefs.isShowProps());
            userPrefs.setShowReplies(reqUserPrefs.isShowReplies());
            userPrefs.setRssHeadlinesOnly(reqUserPrefs.isRssHeadlinesOnly());
            userPrefs.setMainPanelCols(reqUserPrefs.getMainPanelCols());
            userPrefs.setAiService(reqUserPrefs.getAiService());
            return null;
        });
        return res;
    }

    public SaveUserProfileResponse saveUserProfile(SaveUserProfileRequest req) {
        SaveUserProfileResponse res = new SaveUserProfileResponse();
        String userName = ThreadLocals.getSC().getUserName();
        arun.run(as -> {
            boolean failed = false;
            SubNode userNode = read.getAccountByUserName(as, userName, false);
            // DO NOT DELETE: This is temporaryly disabled (no ability to edit userName)
            // If userName is changing, validate it first.
            // if (!req.getUserName().equals(userName)) {
            // validator.checkUserName(req.getUserName());
            // SubNode nodeFound = api.getUserNodeByUserName(session, req.getUserName());
            // if (ok(nodeFound )) {
            // res.setMessage("User already exists.");
            // res.setSuccess(false);
            // failed = true;
            // }
            // }
            if (!failed) {
                userNode.set(NodeProp.USER_BIO, req.getUserBio());
                userNode.set(NodeProp.USER_TAGS, req.getUserTags());
                userNode.set(NodeProp.USER_BLOCK_WORDS, processBlockedWords(req.getBlockedWords()));
                userNode.set(NodeProp.USER_RECENT_TYPES, req.getRecentTypes());
                userNode.set(NodeProp.DISPLAY_NAME, req.getDisplayName());
                userNode.set(NodeProp.MFS_ENABLE, req.isMfsEnable());
                update.save(as, userNode);
            }
            return null;
        });
        return res;
    }

    /* Takes in blockedWords and returns them as a unique and sorted array, each on a separate line */
    public String processBlockedWords(String blockedWords) {
        if (blockedWords == null)
            return null;
        HashSet<String> wordsSet = new HashSet<>();
        StringTokenizer t = new StringTokenizer(blockedWords, " \n\r\t,", false);

        while (t.hasMoreTokens()) {
            wordsSet.add(t.nextToken());
        }
        ArrayList<String> wordsList = new ArrayList<>(wordsSet);
        wordsList.sort((a, b) -> a.compareTo(b));
        return String.join("\n", wordsList);
    }

    /* The code pattern here is very similar to addFriendInternal */
    public BlockUserResponse blockUsers(MongoSession ms, BlockUserRequest req) {
        BlockUserResponse res = new BlockUserResponse();
        String userName = ThreadLocals.getSC().getUserName();
        ObjectId accntIdDoingBlock = new ObjectId(ThreadLocals.getSC().getUserNodeId());
        // get the node that holds all blocked users
        SubNode blockedList = user.getBlockedUsers(ms, userName, true);
        List<String> users = XString.tokenize(req.getUserName().trim(), "\n", true);

        users.forEach(u -> {
            blockUser(ms, u, accntIdDoingBlock, blockedList);
        });
        return res;
    }

    private void blockUser(MongoSession ms, String userToBlock, ObjectId accntIdDoingBlock, SubNode blockedList) {
        SubNode userNode = read.findFriendNode(ms, accntIdDoingBlock, null, userToBlock);

        // if we have this node but in some obsolete path delete it. Might be the path of FRIENDS_LIST!
        if (userNode != null && !mongoUtil.isChildOf(blockedList, userNode)) {
            delete.delete(ms, userNode);
            userNode = null;
        }

        if (userNode == null) {
            userNode = friend.createFriendNode(ms, blockedList, userToBlock, null);
            if (userNode != null) {
                log.debug("Blocked user " + userToBlock);
            }
        }
    }

    public void exportPeople(MongoSession ms, HttpServletResponse response, String disposition, String listType) {
        try {
            StringBuilder sb = new StringBuilder();
            Criteria moreCriteria = null;
            String fileName = listType.equals(NodeType.FRIEND_LIST.s()) ? "friends.txt" : "blocks.txt";
            List<SubNode> friendNodes = getSpecialNodesList(ms, null, listType, ms.getUserName(), true, moreCriteria);

            if (friendNodes != null) {
                for (SubNode friendNode : friendNodes) {
                    String userNodeId = friendNode.getStr(NodeProp.USER_NODE_ID);
                    SubNode friendAccountNode = read.getNode(ms, userNodeId, false, null);
                    if (friendAccountNode != null) {
                        String userName = friendNode.getStr(NodeProp.USER);
                        sb.append(userName);

                        if (listType.equals(NodeType.FRIEND_LIST.s())) {
                            sb.append(",");
                            sb.append(friendNode.getTags());
                        }
                        sb.append("\n");
                    }
                }
            }

            if (disposition == null) {
                disposition = "inline";
            }

            response.setContentType("text/plain");
            response.setContentLength((int) sb.length());
            response.setHeader("Content-Disposition", disposition + "; filename=\"" + fileName + "\"");
            response.getWriter().write(sb.toString());
        } catch (Exception ex) {
            throw ExUtil.wrapEx(ex);
        }
    }

    // parses a comma-delimited 'user' string like "clay, #tag1 #tag2", and sends back the two parts
    // in userVal and tagsVal
    public void parseImportUser(String user, Val<String> userVal, Val<String> tagsVal) {
        final List<String> parts = XString.tokenize(user, ",", true);
        if (parts.size() > 0) {
            userVal.setVal(parts.get(0));
        }
        if (parts.size() > 1) {
            tagsVal.setVal(parts.get(1));
        }
    }

    /*
     * Abbreviated flag means don't get ALL the info for the user but an abbreviated object that's
     * faster to generate like what we need when someone is logging in and the login endpoint needs
     * their own profile info as fast as possible.
     *
     * caller should pass in 'userNode' if it's available or else userId will be used to get it.
     */
    public UserProfile getUserProfile(String userId, SubNode _userNode, boolean abbreviated) {
        String sessionUserName = ThreadLocals.getSC().getUserName();
        return (UserProfile) arun.run(as -> {
            UserProfile userProfile = null;
            SubNode userNode = null;
            if (_userNode == null) {
                if (userId == null) {
                    userNode = read.getAccountByUserName(as, sessionUserName, false);
                } else {
                    userNode = read.getNode(as, userId, false, null);
                }
            } else {
                userNode = _userNode;
            }
            if (userNode != null) {
                userProfile = new UserProfile();
                String nodeUserName = userNode.getStr(NodeProp.USER);
                String displayName = getFriendlyNameFromNode(userNode);
                userProfile.setUserName(nodeUserName);
                userProfile.setDisplayName(displayName);
                userProfile.setMfsEnable(userNode.getBool(NodeProp.MFS_ENABLE));
                userProfile.setUserBio(userNode.getStr(NodeProp.USER_BIO));
                userProfile.setDidIPNS(userNode.getStr(NodeProp.USER_DID_IPNS));
                userProfile.setUserTags(userNode.getStr(NodeProp.USER_TAGS));
                userProfile.setBlockedWords(userNode.getStr(NodeProp.USER_BLOCK_WORDS));
                userProfile.setRecentTypes(userNode.getStr(NodeProp.USER_RECENT_TYPES));

                BigDecimal balance = tranRepository.getBalByMongoId(userNode.getIdStr());
                userProfile.setBalance(balance);

                Attachment att = userNode.getAttachment(Constant.ATTACHMENT_PRIMARY.s(), false, false);
                if (att != null) {
                    userProfile.setAvatarVer(att.getBin());
                }
                Attachment headerAtt = userNode.getAttachment(Constant.ATTACHMENT_HEADER.s(), false, false);
                if (headerAtt != null) {
                    userProfile.setHeaderImageVer(headerAtt.getBin());
                }
                userProfile.setUserNodeId(userNode.getIdStr());
                userProfile.setApIconUrl(userNode.getStr(NodeProp.USER_ICON_URL));
                userProfile.setApImageUrl(userNode.getStr(NodeProp.USER_BANNER_URL));

                if (!abbreviated) {
                    SubNode userHomeNode = read.getNodeByName(as, nodeUserName + ":" + Const.HOME_NODE_NAME);
                    if (userHomeNode != null) {
                        userProfile.setHomeNodeId(userHomeNode.getIdStr());
                    }
                    Long followerCount = friend.countFollowersOfUser(as, sessionUserName, userNode, nodeUserName);
                    userProfile.setFollowerCount(followerCount.intValue());
                    Long followingCount = friend.countFollowingOfUser(as, sessionUserName, nodeUserName);
                    userProfile.setFollowingCount(followingCount.intValue());
                    if (!ThreadLocals.getSC().isAnonUser()) {
                        boolean blocked = userIsBlockedByMe(as, userNode, nodeUserName);
                        userProfile.setBlocked(blocked);
                        boolean following = userIsFollowedByMe(as, userNode, nodeUserName);
                        userProfile.setFollowing(following);
                    }
                }
            }
            return userProfile;
        });
    }

    public String getFriendlyNameFromNode(SubNode userNode) {
        String displayName = userNode.getStr(NodeProp.DISPLAY_NAME);
        if (StringUtils.isEmpty(displayName)) {
            String userName = userNode.getStr(NodeProp.USER);
            if (userName != null) {
                displayName = userName;
            }
        }
        return displayName;
    }

    public boolean userIsFollowedByMe(MongoSession ms, SubNode inUserNode, String maybeFollowedUser) {
        String userName = ThreadLocals.getSC().getUserName();
        SubNode friendsList =
                read.getUserNodeByType(ms, userName, null, "### Friends", NodeType.FRIEND_LIST.s(), null, false);
        if (friendsList == null)
            return false;
        // note: findFriend() could work here, but findFriend doesn't tell us IF it's INDEED a Friend or
        // Block. Our FRIEND type is used for both Friends and BLOCKs, which is kind of confusing.
        SubNode userNode =
                read.findNodeByUserAndType(ms, friendsList, inUserNode, maybeFollowedUser, NodeType.FRIEND.s());
        return userNode != null;
    }

    public boolean userIsBlockedByMe(MongoSession ms, SubNode inUserNode, String maybeBlockedUser) {
        String userName = ThreadLocals.getSC().getUserName();
        SubNode blockedList = user.getBlockedUsers(ms, userName, false);
        if (blockedList == null)
            return false;
        // note: findFriend() could work here, but findFriend doesn't tell us IF it's INDEED a Friend or
        // Block.
        // Our FRIEND type is used for both Friends and BLOCKs, which is kind of confusing.
        SubNode userNode =
                read.findNodeByUserAndType(ms, blockedList, inUserNode, maybeBlockedUser, NodeType.FRIEND.s());
        return userNode != null;
    }

    public UserPreferences getDefaultUserPreferences() {
        UserPreferences userPrefs = new UserPreferences();
        userPrefs.setShowMetaData(true);
        userPrefs.setShowProps(false);
        return userPrefs;
    }

    public UserPreferences getUserPreferences(String userName, SubNode _prefsNode) {
        UserPreferences userPrefs = new UserPreferences();
        arun.run(as -> {
            SubNode prefsNode = _prefsNode;
            if (prefsNode == null) {
                prefsNode = read.getAccountByUserName(as, userName, false);
            }
            userPrefs.setEditMode(prefsNode.getBool(NodeProp.USER_PREF_EDIT_MODE));
            userPrefs.setShowMetaData(prefsNode.getBool(NodeProp.USER_PREF_SHOW_METADATA));
            userPrefs.setShowProps(prefsNode.getBool(NodeProp.USER_PREF_SHOW_PROPS));
            userPrefs.setAutoRefreshFeed(prefsNode.getBool(NodeProp.USER_PREF_AUTO_REFRESH_FEED)); // #add-prop
            userPrefs.setShowReplies(prefsNode.getBool(NodeProp.USER_PREF_SHOW_REPLIES));
            userPrefs.setRssHeadlinesOnly(prefsNode.getBool(NodeProp.USER_PREF_RSS_HEADINGS_ONLY));
            long maxFileSize = prefsNode.getInt(NodeProp.BIN_QUOTA);
            if (maxFileSize == 0) {
                maxFileSize = Const.DEFAULT_USER_QUOTA;
            }
            userPrefs.setMaxUploadFileSize(maxFileSize);
            long mainPanelCols = prefsNode.getInt(NodeProp.USER_PREF_MAIN_PANEL_COLS);
            if (mainPanelCols == 0) {
                mainPanelCols = 6;
            }
            userPrefs.setMainPanelCols(mainPanelCols);

            String aiService = prefsNode.getStr(NodeProp.USER_PREF_AI_SERVICE);
            if (StringUtils.isEmpty(aiService)) {
                aiService = "openAi";
            }
            userPrefs.setAiService(aiService);
            return null;
        });
        return userPrefs;
    }

    /*
     * Runs when user is doing the 'change password' or 'reset password'
     */
    public ChangePasswordResponse changePassword(MongoSession ms, ChangePasswordRequest req) {
        ChangePasswordResponse res = new ChangePasswordResponse();
        ms = ThreadLocals.ensure(ms);
        Val<SubNode> userNode = new Val<>();
        Val<String> userName = new Val<>();
        String passCode = req.getPassCode();
        if (passCode != null) {
            // We can run this block as admin, because the codePart below is secret and is checked for a match
            arun.run(as -> {
                String userNodeId = XString.truncAfterFirst(passCode, "-");
                if (userNodeId == null) {
                    throw new RuntimeEx("Unable to find userNodeId: " + userNodeId);
                }
                userNode.setVal(read.getNode(as, userNodeId));
                if (userNode.getVal() == null) {
                    throw ExUtil.wrapEx("Invald password reset code.");
                }
                String codePart = XString.parseAfterLast(passCode, "-");
                String nodeCodePart = userNode.getVal().getStr(NodeProp.USER_PREF_PASSWORD_RESET_AUTHCODE);
                if (!codePart.equals(nodeCodePart)) {
                    throw ExUtil.wrapEx("Invald password reset code.");
                }
                String password = req.getNewPassword();
                userName.setVal(userNode.getVal().getStr(NodeProp.USER));
                if (PrincipalName.ADMIN.s().equals(userName.getVal())) {
                    throw new RuntimeEx("changePassword should not be called fror admin user.");
                }
                userNode.getVal().set(NodeProp.PWD_HASH, mongoUtil.getHashOfPassword(password));
                userNode.getVal().delete(NodeProp.USER_PREF_PASSWORD_RESET_AUTHCODE);
                // note: the adminRunner.run saves the session so we don't do that here.
                return null;
            });
        } else {
            userNode.setVal(read.getAccountByUserName(ms, ms.getUserName(), true));
            if (userNode.getVal() == null) {
                throw ExUtil.wrapEx("changePassword cannot find user.");
            }
            if (PrincipalName.ADMIN.s().equals(userName.getVal())) {
                throw new RuntimeEx("changePassword should not be called fror admin user.");
            }
            String password = req.getNewPassword();
            userName.setVal(userNode.getVal().getStr(NodeProp.USER));
            userNode.getVal().set(NodeProp.PWD_HASH, mongoUtil.getHashOfPassword(password));
            userNode.getVal().delete(NodeProp.USER_PREF_PASSWORD_RESET_AUTHCODE);
            update.save(ms, userNode.getVal());
        }
        res.setUser(userName.getVal());
        return res;
    }

    public boolean isNormalUserName(String userName) {
        userName = userName.trim();
        return !userName.equalsIgnoreCase(PrincipalName.ADMIN.s())
                && !userName.equalsIgnoreCase(PrincipalName.ANON.s());
    }

    public ResetPasswordResponse resetPassword(ResetPasswordRequest req) {
        ResetPasswordResponse res = new ResetPasswordResponse();
        arun.run(as -> {
            String user = req.getUser();
            String email = req.getEmail();
            // make sure username itself is acceptalbe
            if (!isNormalUserName(user)) {
                res.error("User name is illegal.");
                return null;
            }
            SubNode ownerNode = read.getAccountByUserName(as, user, false);
            if (ownerNode == null) {
                res.error("User does not exist.");
                return null;
            }
            // IMPORTANT!
            //
            // verify that the email address provides IS A MATCH to the email address for this user!
            String nodeEmail = ownerNode.getStr(NodeProp.EMAIL);
            if (nodeEmail == null || !nodeEmail.equals(email)) {
                res.error("Wrong user name and/or email.");
                return null;
            }
            // if we make it to here the user and email are both correct, and we can initiate the password
            // reset. We pick some random time between 1 and 2 days from now into the future to serve as the
            // unguessable auth code AND the expire time for it. Later we can create a deamon processor that
            // cleans up expired authCodes, but for now we just need to HAVE the auth code.
            //
            // User will be emailed this code and we will perform reset when we see it, and the user has
            // entered
            // new password we can use.
            int oneDayMillis = 60 * 60 * 1000;
            long authCode = new Date().getTime() + oneDayMillis + rand.nextInt(oneDayMillis);
            ownerNode.set(NodeProp.USER_PREF_PASSWORD_RESET_AUTHCODE, String.valueOf(authCode));
            update.save(as, ownerNode);
            String passCode = ownerNode.getIdStr() + "-" + String.valueOf(authCode);
            String link = prop.getHostAndPort() + "?passCode=" + passCode;
            String brandingAppName = prop.getConfigText("brandingAppName");
            String content = //
                    "Password reset was requested on " + brandingAppName + " account: " + user
                            + "<p>\nGo to this link to reset your password: <br>\n" + link;
            outbox.queueEmail(email, brandingAppName + " Password Reset", content);
            res.setMessage("A password reset link has been sent to your email. Check your email in a minute or so.");
            return null;
        });
        return res;
    }

    public GetPeopleResponse getPeopleOnNode(MongoSession ms, String nodeId) {
        GetPeopleResponse res = new GetPeopleResponse();
        SubNode node = read.getNode(ms, nodeId);
        if (node == null) {
            res.setMessage("Unable to find node.");
            res.setCode(HttpServletResponse.SC_EXPECTATION_FAILED);
        }
        String ownerIdStr = node.getOwner().toHexString();
        HashSet<String> idSet = new HashSet<>();

        List<FriendInfo> friends = new LinkedList<>();
        arun.run(as -> {
            SubNode ownerAccntNode = read.getNode(as, node.getOwner());
            if (ownerAccntNode != null) {
                FriendInfo ownerInfo = buildPersonInfoFromAccntNode(as, ownerAccntNode);
                if (node.getLikes() != null && node.getLikes().contains(ownerInfo.getUserName())) {
                    ownerInfo.setLiked(true);
                }
                res.setNodeOwner(ownerInfo);
            }

            if (node.getAc() != null) {
                // Lookup all userNames from the ACL info, to add them all to 'toUserNames'
                for (String accntId : node.getAc().keySet()) {
                    // ignore public, it's not a user.
                    if (accntId.equals(ownerIdStr) || idSet.contains(accntId)
                            || PrincipalName.PUBLIC.s().equals(accntId))
                        continue;
                    SubNode accntNode = read.getNode(as, accntId, false, null);
                    if (accntNode != null) {
                        FriendInfo fi = buildPersonInfoFromAccntNode(as, accntNode);
                        if (fi != null) {
                            friends.add(fi);
                            idSet.add(accntId);
                        }
                    }
                }
                res.setPeople(friends);
            }
            return null;
        });

        friends.sort((f1, f2) -> f1.getUserName().compareTo(f2.getUserName()));
        return res;
    }

    public FriendInfo buildPersonInfoFromAccntNode(MongoSession ms, SubNode userNode) {
        FriendInfo fi = new FriendInfo();
        String displayName = user.getFriendlyNameFromNode(userNode);
        fi.setUserName(displayName);
        fi.setDisplayName(userNode.getStr(NodeProp.DISPLAY_NAME));
        fi.setUserNodeId(userNode.getIdStr());
        fi.setForeignAvatarUrl(userNode.getStr(NodeProp.USER_ICON_URL));
        String userName = userNode.getStr(NodeProp.USER);
        if (userName.indexOf("@") == -1) {
            Attachment att = userNode.getAttachment(Constant.ATTACHMENT_PRIMARY.s(), false, false);
            if (att != null) {
                fi.setAvatarVer(att.getBin());
            }
        }
        return fi;
    }

    public GetPeopleResponse getPeople(MongoSession ms, String userName, String type) {
        GetPeopleResponse res = new GetPeopleResponse();
        String nodeType = null;
        Criteria moreCriteria = null;
        if ("friends".equals(type)) {
            nodeType = NodeType.FRIEND_LIST.s();
        } //
        else if ("blocks".equals(type)) { //
            nodeType = NodeType.BLOCKED_USERS.s();
        } else {
            throw new RuntimeException("Invalid type: " + type);
        }
        List<SubNode> friendNodes = getSpecialNodesList(ms, null, nodeType, userName, true, moreCriteria);
        if (friendNodes != null) {
            List<FriendInfo> friends = new LinkedList<>();

            for (SubNode friendNode : friendNodes) {
                FriendInfo fi = friend.buildPersonInfoFromFriendNode(ms, friendNode);
                if (fi != null) {
                    friends.add(fi);
                } else {
                    log.debug("Friend account node is missing. Cleaning up friend id: "
                            + friendNode.getId().toHexString());
                    delete.adminDelete(friendNode.getId());
                }
            }
            res.setPeople(friends);
        }
        return res;
    }

    public Object getPeople(GetPeopleRequest req, MongoSession ms) {
        GetPeopleResponse ret = null;
        if (req.getNodeId() != null) {
            ret = user.getPeopleOnNode(ms, req.getNodeId());
        } else {
            ret = user.getPeople(ms, ThreadLocals.getSC().getUserName(), req.getType());
        }
        ret.setFriendHashTags(userFeed.getFriendsHashTags(ms));
        return ret;
    }

    /**
     * Looks in the userName's account under their 'underType' type node and returns all the children.
     * If userName is passed as null, then we use the currently logged in user
     */
    public List<SubNode> getSpecialNodesList(MongoSession ms, Val<SubNode> parentNodeVal, String underType,
            String userName, boolean sort, Criteria moreCriteria) {
        ms = ThreadLocals.ensure(ms);
        List<SubNode> nodeList = new LinkedList<>();
        SubNode userNode = read.getAccountByUserName(ms, userName, false);
        if (userNode == null)
            return null;
        SubNode parentNode = read.findSubNodeByType(ms, userNode, underType);
        if (parentNode == null)
            return null;
        if (parentNodeVal != null) {
            parentNodeVal.setVal(parentNode);
        }
        for (SubNode node : read.getChildren(ms, parentNode, sort ? Sort.by(Sort.Direction.ASC, SubNode.ORDINAL) : null,
                null, 0, moreCriteria, true)) {
            nodeList.add(node);
        }
        return nodeList;
    }

    /*
     * For all foreign servers we remove posts that are older than a certain number of days just to keep
     * our DB from growing too large.
     */
    public void cleanUserAccounts() {
        // not currently used.
        if (true)
            return;
        // adminRunner.run(session -> {
        // final Iterable<SubNode> accountNodes =
        // read.getChildrenUnderParentPath(session, NodePath.ROOT_OF_ALL_USERS, null, null, 0, null, null);
        // for (final SubNode accountNode : accountNodes) {
        // String userName = accountNode.getStrProp(NodeProp.USER);
        // // if account is a 'foreign server' one, then clean it up
        // if (ok(userName )) {
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

    public String getUserAccountsReport(MongoSession ms) {
        ms = ThreadLocals.ensure(ms);
        StringBuilder sb = new StringBuilder();
        long localUserCount = read.getAccountNodeCount(ms, null);
        sb.append("User Count: " + localUserCount + "\n");
        return sb.toString();
    }

    public void updateLastActiveTime(SessionContext sc) {
        arun.run(as -> {
            SubNode userNode = read.getAccountByUserName(as, sc.getUserName(), false);
            if (userNode != null) {
                userNode.set(NodeProp.LAST_ACTIVE_TIME, sc.getLastActiveTime());
                update.save(as, userNode);
            }
            return null;
        });
    }

    public long getUserStorageQuota(MongoSession ms) {
        if (ms.isAnon()) {
            return 0;
        }
        if (ms.isAdmin()) {
            return Integer.MAX_VALUE;
        }
        SubNode userNode = read.getAccountByUserName(null, ThreadLocals.getSC().getUserName(), false);
        long ret = userNode.getInt(NodeProp.BIN_QUOTA);
        if (ret == 0) {
            return Const.DEFAULT_USER_QUOTA;
        }
        return ret;
    }

    public int getUserStorageRemaining(MongoSession ms) {
        if (ms.isAnon()) {
            return 0;
        }
        if (ms.isAdmin()) {
            return Integer.MAX_VALUE;
        }
        SubNode userNode = read.getAccountByUserName(null, ThreadLocals.getSC().getUserName(), false);
        if (userNode == null)
            return 0;

        int quota = userNode.getInt(NodeProp.BIN_QUOTA).intValue();
        if (quota == 0) {
            return Const.DEFAULT_USER_QUOTA;
        }
        int binTotal = userNode.getInt(NodeProp.BIN_TOTAL).intValue();
        return quota - binTotal;
    }

    public Object logout(HttpSession session) {
        redis.delete(ThreadLocals.getSC());
        ThreadLocals.getSC().forceAnonymous();
        session.invalidate();
        LogoutResponse res = new LogoutResponse();
        return res;
    }

    public Object getUserProfile(GetUserProfileRequest req) {
        GetUserProfileResponse res = new GetUserProfileResponse();
        UserProfile userProfile = user.getUserProfile(req.getUserId(), null, false);
        if (userProfile != null) {
            res.setUserProfile(userProfile);
        }
        return res;
    }
}
