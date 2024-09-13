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
import org.springframework.data.mongodb.core.query.CriteriaDefinition;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import quanta.config.NodePath;
import quanta.config.ServiceBase;
import quanta.config.SessionContext;
import quanta.exception.OutOfSpaceException;
import quanta.exception.UnauthorizedException;
import quanta.exception.base.RuntimeEx;
import quanta.model.UserPreferences;
import quanta.model.UserStats;
import quanta.model.client.AIModel;
import quanta.model.client.Attachment;
import quanta.model.client.Constant;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.model.client.PrincipalName;
import quanta.model.client.PrivilegeType;
import quanta.model.client.UserProfile;
import quanta.mongo.MongoTranMgr;
import quanta.mongo.model.AccountNode;
import quanta.mongo.model.CreateNodeLocation;
import quanta.mongo.model.SubNode;
import quanta.postgres.PgTranMgr;
import quanta.postgres.table.Tran;
import quanta.postgres.table.UserAccount;
import quanta.rest.request.BlockUserRequest;
import quanta.rest.request.ChangePasswordRequest;
import quanta.rest.request.CloseAccountRequest;
import quanta.rest.request.DeleteUserTransactionsRequest;
import quanta.rest.request.GetPeopleRequest;
import quanta.rest.request.GetUserAccountInfoRequest;
import quanta.rest.request.GetUserProfileRequest;
import quanta.rest.request.LoginRequest;
import quanta.rest.request.ResetPasswordRequest;
import quanta.rest.request.SaveUserPreferencesRequest;
import quanta.rest.request.SaveUserProfileRequest;
import quanta.rest.request.SendFeedbackRequest;
import quanta.rest.request.SignupRequest;
import quanta.rest.response.AddCreditResponse;
import quanta.rest.response.BlockUserResponse;
import quanta.rest.response.ChangePasswordResponse;
import quanta.rest.response.CloseAccountResponse;
import quanta.rest.response.DeleteUserTransactionsResponse;
import quanta.rest.response.FriendInfo;
import quanta.rest.response.GetPeopleResponse;
import quanta.rest.response.GetUserAccountInfoResponse;
import quanta.rest.response.GetUserProfileResponse;
import quanta.rest.response.LoginResponse;
import quanta.rest.response.ResetPasswordResponse;
import quanta.rest.response.SaveUserPreferencesResponse;
import quanta.rest.response.SaveUserProfileResponse;
import quanta.rest.response.SendFeedbackResponse;
import quanta.rest.response.SignupResponse;
import quanta.rest.response.UpdateAccountInfo;
import quanta.util.Const;
import quanta.util.DateUtil;
import quanta.util.ExUtil;
import quanta.util.TL;
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

    private static SubNode usersNode = null;
    private static HashSet<String> testAccountNames = new HashSet<>();
    private static final Random rand = new Random();
    public static final float INITIAL_GRANT_AMOUNT = 0.01f;

    /* Private keys of each user by user name as key */
    // private static final ConcurrentHashMap<String, String> privateKeysByUserName = new
    // ConcurrentHashMap<>();

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
            log.debug("SseEmitter token " + token + " on replica " + svc_prop.getSwarmTaskSlot());
        }
        return emitter;
    }

    // todo-2: can this function AND "reqBearerToken" (not bearerToken) can be factored out for a
    // more consistent design letting all the logic be only in AppFilter
    public void authBearer() {
        SessionContext sc = TL.getSC();
        if (sc == null) {
            throw new RuntimeException("Unable to get SessionContext to check token.");
        }

        if (StringUtils.isEmpty(sc.getUserName())) {
            throw new RuntimeException("No user name in session context.");
        }

        // NOTE: This token (if in header, request url, or session variable) will have been set in the
        // ThreadLocals inside AppFilter if available, but not checked against userName until here, in
        // this method.
        String bearer = TL.getReqBearerToken();

        // otherwise require secure header
        if (!validToken(bearer, sc.getUserName())) {
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

        SessionContext sc = svc_redis.get(token);
        return sc != null && (userName == null || sc.getUserName().equals(userName));
    }

    /*
     * Note that this function does 'succeed' even with ANON user given, and just considers that an
     * anonymouse user
     */
    public LoginResponse login(HttpServletRequest httpReq, LoginRequest req) {
        MongoTranMgr.ensureTran();
        LoginResponse res = new LoginResponse();
        SessionContext sc = TL.getSC();
        Val<AccountNode> userNodeVal = new Val<>();

        // Anonymous user
        if (req.getUserName() == null || PrincipalName.ANON.s().equals(req.getUserName())) {
            log.debug("Anonymous user login.");
            // just as a precaution update the sc userName to anon values
            sc.setUserName(PrincipalName.ANON.s());
            sc.setUserNodeId(null);
        }
        // Admin Login
        else if (PrincipalName.ADMIN.s().equalsIgnoreCase(req.getUserName().trim())) {
            if (!svc_prop.getAdminPassword().equals(req.getPassword())) {
                throw new RuntimeException("Unauthorized");
            }

            svc_arun.run(() -> {
                AccountNode userNode = svc_user.getAccountByUserNameAP(req.getUserName());
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
            svc_arun.run(() -> {
                AccountNode userNode = svc_user.getAccountByUserNameAP(req.getUserName());
                if (userNode == null) {
                    throw new RuntimeException("User not found: " + req.getUserName());
                }
                userNodeVal.setVal(userNode);
                String userName = userNode.getStr(NodeProp.USER);
                String checkHash = userNode.getStr(NodeProp.PWD_HASH);
                String reqHash = svc_mongoUtil.getHashOfPassword(req.getPassword());
                if (!checkHash.equals(reqHash)) {
                    throw new RuntimeException("Unauthorized");
                }
                setAuthenticated(sc, userName, userNode.getId());
                return null;
            });
        }

        // We have to get timezone information from the user's browser, so that all times on all nodes
        // always show up in their precise local time!
        sc.setTimezone(DateUtil.getTimezoneFromOffset(req.getTzOffset()));
        sc.setTimeZoneAbbrev(DateUtil.getUSTimezone(-req.getTzOffset() / 60, req.getDst()));
        res.setAnonUserLandingPageNode(svc_prop.getUserLandingPageNode());
        if (sc.getUserToken() != null) {
            processLogin(res, userNodeVal.getVal(), sc.getUserName(), req.getAsymEncKey(), req.getSigKey());
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
            log.debug("userName: " + userName + " NEW userToken: " + sc.getUserToken() + " sessionId="
                    + TL.getHttpSession().getId());
        }
        sc.setUserName(userName);
        sc.setUserNodeId(userNodeId.toHexString());
    }

    public SubNode getNotesNode(String userName, AccountNode userNode) {
        return svc_mongoRead.getUserNodeByType(userName, userNode, "### Notes", NodeType.NOTES.s(), null, true);
    }

    public SubNode getPostsNode(String userName, AccountNode userNode) {
        return svc_mongoRead.getUserNodeByType(userName, userNode, "### Posts", NodeType.POSTS.s(),
                Arrays.asList(PrivilegeType.READ.s()), true);
    }

    public SubNode getFriendsList(String userName, boolean create) {
        return svc_mongoRead.getUserNodeByType(userName, null, "### Friends List", NodeType.FRIEND_LIST.s(), null,
                create);
    }

    public SubNode getBlockedUsers(String userName, boolean create) {
        return svc_mongoRead.getUserNodeByType(userName, null, "### Blocked Users", NodeType.BLOCKED_USERS.s(), null,
                create);
    }

    /*
     * caller can optionally pass userNode if it's already available, or else it will be looked up using
     * userName
     */
    public void processLogin(LoginResponse res, AccountNode userNode, String userName, String asymEncKey,
            String sigKey) {
        SessionContext sc = TL.getSC();
        if (userNode == null) {
            userNode = svc_user.getAccountByUserNameAP(userName);
        }
        if (userNode == null) {
            throw new RuntimeEx("User not found: " + userName);
        }
        String id = userNode.getIdStr();
        if (id == null) {
            throw new RuntimeException("userNode id is null for user: " + userName);
        }
        sc.setUserNodeId(id);
        UserPreferences userPreferences = getUserPreferences(userName, userNode);
        sc.setUserPreferences(userPreferences);
        res.setRootNodePath(userNode.getPath());
        res.setAllowFileSystemSearch(svc_prop.isAllowFileSystemSearch());
        res.setUserPreferences(userPreferences);
        res.setAuthToken(sc.getUserToken());
        Date now = new Date();
        sc.setLastLoginTime(now.getTime());
        userNode.set(NodeProp.LAST_LOGIN_TIME, now.getTime());
        if (!StringUtils.isEmpty(asymEncKey))
            userNode.setIfNotExist(NodeProp.USER_PREF_PUBLIC_KEY, asymEncKey);
        if (!StringUtils.isEmpty(sigKey))
            userNode.setIfNotExist(NodeProp.USER_PREF_PUBLIC_SIG_KEY, sigKey);
        TL.getSC().setPubSigKeyJson(null);
        res.setUserProfile(svc_user.getUserProfile(userNode.getIdStr(), userNode, true));

        @SuppressWarnings("unused")
        SubNode notesNode = svc_user.getNotesNode(userName, userNode);
        svc_mongoUpdate.save(userNode);
    }

    public CloseAccountResponse closeAccount(CloseAccountRequest req, HttpSession session) {
        MongoTranMgr.ensureTran();
        CloseAccountResponse res = new CloseAccountResponse();
        log.debug("Closing Account: " + TL.getSC().getUserName());
        svc_arun.run(() -> {
            String userName = TL.getSC().getUserName();
            AccountNode ownerNode = svc_user.getAccountByUserNameAP(userName);
            if (ownerNode != null) {
                svc_mongoDelete.delete(ownerNode, false);
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
    public void writeUserStats(HashMap<ObjectId, UserStats> userStats) {
        userStats.forEach((ObjectId key, UserStats stat) -> {
            AccountNode node = svc_user.getAccountNode(key);
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
    public void addBytesToUserNodeBytes(long binSize, AccountNode userNode) {
        if (userNode == null) {
            userNode = svc_user.getSessionUserAccount();
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
        if (!TL.hasAdminPrivileges() && binTotal > userQuota) {
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
        return svc_arun.run(() -> {
            // signupCode is just the new account node id? I guess that's secure, if user
            // has this value it's the only user who could possibly know this unguessable value.
            AccountNode node = svc_user.getAccountNode(signupCode);
            if (node != null) {
                if (!node.getBool(NodeProp.SIGNUP_PENDING)) {
                    return "Signup Complete. You may login now.";
                } else {
                    String userName = node.getStr(NodeProp.USER);
                    if (PrincipalName.ADMIN.s().equalsIgnoreCase(userName)) {
                        return "processSignupCode should not be called for admin user.";
                    } else {
                        node.delete(NodeProp.SIGNUP_PENDING);
                        svc_mongoUpdate.save(node);
                        return "Signup Successful. You may login now.";
                    }
                }
            } else {
                return "Signup Code is invalid.";
            }
        });
    }

    public void initNewUser(String userName, String password, String email, boolean automated) {
        AccountNode userNode = createUser(userName, email, password, automated, null);
        if (userNode != null) {
            log.debug("Successful signup complete.");
        }
    }

    /*
     * Processes a signup request from a user. We create the user root node in a pending state, and like
     * all other user accounts all information specific to that user that we currently know is held in
     * that node (i.e. preferences)
     */
    public SignupResponse signup(SignupRequest req, boolean automated) {
        MongoTranMgr.ensureTran();
        SignupResponse res = new SignupResponse();
        res.setCode(HttpServletResponse.SC_OK);
        svc_arun.run(() -> {
            String userName = req.getUserName().trim();
            String password = req.getPassword().trim();
            String email = req.getEmail().trim();
            log.debug("Signup: userName=" + userName + " email=" + email);

            String userError = svc_validator.checkUserName(userName);
            if (userError != null) {
                res.setUserError(userError);
                res.setCode(HttpServletResponse.SC_EXPECTATION_FAILED);
            }
            String passwordError = svc_validator.checkPassword(password);
            if (passwordError != null) {
                res.setPasswordError(passwordError);
                res.setCode(HttpServletResponse.SC_EXPECTATION_FAILED);
            }
            String emailError = svc_validator.checkEmail(email);
            if (emailError != null) {
                res.setEmailError(emailError);
                res.setCode(HttpServletResponse.SC_EXPECTATION_FAILED);
            }

            // we disallow dupliate emails via this codepath, but by design we do allow them in the DB, and
            // even all the 'test accounts' will normally have the same email address.
            SubNode ownerNode = svc_mongoRead.getUserNodeByPropAP(NodeProp.EMAIL.s(), email, false);
            if (ownerNode != null) {
                res.setEmailError("Email already in use.");
                res.setCode(HttpServletResponse.SC_EXPECTATION_FAILED);
            }

            if (!automated) {
                String captcha = (String) TL.getHttpSession().getAttribute("captcha");
                if (!captcha.equals(req.getCaptcha())) {
                    Util.sleep(3000);
                    res.setCaptchaError("Wrong captcha. Try again.");
                    res.setCode(HttpServletResponse.SC_EXPECTATION_FAILED);
                }

                if (res.getCode() == null || res.getCode() != HttpServletResponse.SC_OK) {
                    return res;
                }
                initiateSignup(userName, password, email);
            } else {
                initNewUser(userName, password, email, automated);
            }
            return null;
        });
        return res;
    }

    /*
     * Adds user to the list of pending accounts and they will stay in pending status until their
     * signupCode has been used to validate their email address.
     */
    public void initiateSignup(String userName, String password, String emailAdr) {
        AccountNode ownerNode = getAccountByUserNameAP(userName);
        if (ownerNode != null) {
            throw new RuntimeEx("User already exists.");
        }
        SubNode newUserNode = createUser(userName, emailAdr, password, false, null);
        // It's easiest to use the actua new UserNode ID as the 'signup code' to send to the user, because
        // it's random and tied to this user by definition
        String signupCode = newUserNode.getIdStr();
        String signupLink = svc_prop.getHttpProtocol() + "://" + svc_prop.getMetaHost() + "?signupCode=" + signupCode;
        String content = null;
        // We print this out so we can use it in DEV mode when no email support may be configured
        log.debug("Signup URL: " + signupLink);
        String brandingAppName = svc_prop.getConfigText("brandingAppName");
        content = "Welcome to " + brandingAppName + ", " + userName + "!"
                + "<p>\nUse this link to complete the signup: <br>\n" + signupLink;
        if (!StringUtils.isEmpty(svc_prop.getMailHost())) {
            svc_email.queueEmail(emailAdr, brandingAppName + " - Account Signup", content);
        }
    }

    public void setDefaultUserPreferences(SubNode prefsNode) {
        prefsNode.set(NodeProp.USER_PREF_EDIT_MODE, false);
        prefsNode.set(NodeProp.USER_PREF_AI_MODE, Constant.AI_MODE_CHAT.s());
        prefsNode.set(NodeProp.USER_PREF_RSS_HEADINGS_ONLY, true);
    }

    public GetUserAccountInfoResponse cm_getUserAccountInfo(GetUserAccountInfoRequest req) {
        GetUserAccountInfoResponse res = new GetUserAccountInfoResponse();
        String userName = TL.getSC().getUserName();
        svc_arun.run(() -> {
            AccountNode userNode = getAccountByUserNameAP(userName);
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
        PgTranMgr.ensureTran();
        UserAccount user = svc_userRepo.findByMongoId(userId);
        if (user == null) {
            log.debug("UserAccount not found, creating...");
            user = svc_userRepo.saveAndFlush(new UserAccount(userId, userName));

            Tran credit = new Tran();
            credit.setAmt(new BigDecimal(INITIAL_GRANT_AMOUNT));
            credit.setTransType("C");
            credit.setDescCode("NEW");
            credit.setTs(Timestamp.from(Instant.now()));
            credit.setUserAccount(user);
            svc_tranRepo.saveAndFlush(credit);
            return true;
        }
        return false;
    }

    public DeleteUserTransactionsResponse cm_deleteUserTransactions(DeleteUserTransactionsRequest req) {
        TL.requireAdmin();
        DeleteUserTransactionsResponse res = new DeleteUserTransactionsResponse();
        svc_userRepo.deleteByMongoId(req.getUserId());
        return res;
    }

    public AddCreditResponse addCredit(String userId, BigDecimal amount) {
        PgTranMgr.ensureTran();
        TL.requireAdmin();
        AddCreditResponse res = new AddCreditResponse();
        addCreditInternal(userId, amount, null);
        // calculate new balance and return it.
        res.setBalance(svc_tranRepo.getBalByMongoId(userId));
        return res;
    }

    public Tran addCreditByEmail(String emailAdr, BigDecimal amount, Long timestamp) {
        PgTranMgr.ensureTran();
        SubNode ownerNode = svc_mongoRead.getUserNodeByPropAP(NodeProp.EMAIL.s(), emailAdr, false);
        if (ownerNode != null) {
            String userName = ownerNode.getStr(NodeProp.USER);
            Tran tran = addCreditInternal(ownerNode.getIdStr(), amount, timestamp);

            if (!StringUtils.isEmpty(svc_prop.getMailHost())) {
                String brandingAppName = svc_prop.getConfigText("brandingAppName");
                String content = "Thanks for using " + brandingAppName + ", " + userName + "!" + "<p>\nA payment of $"
                        + amount + " has been applied to your account.";

                svc_email.queueEmail(emailAdr, brandingAppName + " - Account Credit", content);
            }

            BigDecimal credit = svc_tranRepo.getBalByMongoId(ownerNode.getIdStr());
            UpdateAccountInfo pushInfo = new UpdateAccountInfo(ownerNode.getIdStr(), credit);
            svc_push.pushInfo(TL.getSC(), pushInfo);
            return tran;
        } else {
            throw new RuntimeException("addCreditByEmail: user not found for email: " + emailAdr);
        }
    }

    public Tran addCreditInternal(String userId, BigDecimal amount, Long timestamp) {
        UserAccount user = svc_userRepo.findByMongoId(userId);
        if (user == null) {
            log.debug("User not found, creating...");
            AccountNode userNode = svc_user.getAccountNode(userId);
            String userName = userNode.getStr(NodeProp.USER);
            user = new UserAccount(userId, userName);
            user = svc_userRepo.save(user);
            svc_userRepo.flush();
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
        credit = svc_tranRepo.save(credit);
        return credit;
    }

    public SaveUserPreferencesResponse cm_saveUserPreferences(SaveUserPreferencesRequest req) {
        SaveUserPreferencesResponse res = new SaveUserPreferencesResponse();
        UserPreferences userPrefs = TL.getSC().getUserPreferences();
        // note: This will be null if session has timed out.
        if (userPrefs == null) {
            return res;
        }
        UserPreferences reqUserPrefs = req.getUserPreferences();

        // set default chat mode if not existing
        if (StringUtils.isEmpty(reqUserPrefs.getAiMode())) {
            reqUserPrefs.setAiMode(Constant.AI_MODE_CHAT.s());
        }

        String userName = TL.getSC().getUserName();

        svc_arun.run(() -> {
            SubNode prefsNode = svc_mongoRead.getNode(req.getUserNodeId());
            if (prefsNode == null)
                throw new RuntimeException("Unable to update preferences.");
            // Make sure the account node we're about to modify does belong to the current user.

            if (!userName.equals(prefsNode.getStr(NodeProp.USER))) {
                throw new RuntimeException("Not your node.");
            }

            // Assign preferences as properties on this node,
            prefsNode.set(NodeProp.USER_PREF_EDIT_MODE, reqUserPrefs.isEditMode());
            prefsNode.set(NodeProp.USER_PREF_AI_MODE, reqUserPrefs.getAiMode());
            prefsNode.set(NodeProp.USER_PREF_SHOW_METADATA, reqUserPrefs.isShowMetaData());
            prefsNode.set(NodeProp.USER_PREF_SHOW_PROPS, reqUserPrefs.isShowProps());
            prefsNode.set(NodeProp.USER_PREF_AUTO_REFRESH_FEED, reqUserPrefs.isAutoRefreshFeed()); // #add-prop
            prefsNode.set(NodeProp.USER_PREF_SHOW_REPLIES, reqUserPrefs.isShowReplies());
            prefsNode.set(NodeProp.USER_PREF_RSS_HEADINGS_ONLY, reqUserPrefs.isRssHeadlinesOnly());
            prefsNode.set(NodeProp.USER_PREF_MAIN_PANEL_COLS, reqUserPrefs.getMainPanelCols());
            prefsNode.set(NodeProp.USER_PREF_AI_SERVICE, reqUserPrefs.getAiService());
            prefsNode.set(NodeProp.USER_PREF_AI_FILE_EXTENSIONS, reqUserPrefs.getAiAgentFileExtensions());
            prefsNode.set(NodeProp.USER_PREF_AI_FOLDERS_TO_INCLUDE, reqUserPrefs.getAiAgentFoldersToInclude());

            userPrefs.setEditMode(reqUserPrefs.isEditMode());
            userPrefs.setAiMode(reqUserPrefs.getAiMode());
            userPrefs.setShowMetaData(reqUserPrefs.isShowMetaData());
            userPrefs.setShowProps(reqUserPrefs.isShowProps());
            userPrefs.setShowReplies(reqUserPrefs.isShowReplies());
            userPrefs.setRssHeadlinesOnly(reqUserPrefs.isRssHeadlinesOnly());
            userPrefs.setMainPanelCols(reqUserPrefs.getMainPanelCols());
            userPrefs.setAiService(reqUserPrefs.getAiService());
            userPrefs.setAiAgentFileExtensions(reqUserPrefs.getAiAgentFileExtensions());
            userPrefs.setAiAgentFoldersToInclude(reqUserPrefs.getAiAgentFoldersToInclude());
            return null;
        });
        return res;
    }

    public SaveUserProfileResponse saveUserProfile(SaveUserProfileRequest req) {
        MongoTranMgr.ensureTran();
        SaveUserProfileResponse res = new SaveUserProfileResponse();
        String userName = TL.getSC().getUserName();
        svc_arun.run(() -> {
            boolean failed = false;
            AccountNode userNode = svc_user.getAccountByUserNameAP(userName);
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
                svc_mongoUpdate.save(userNode);
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
    public BlockUserResponse cm_blockUsers(BlockUserRequest req) {
        BlockUserResponse res = new BlockUserResponse();
        String userName = TL.getSC().getUserName();
        ObjectId accntIdDoingBlock = new ObjectId(TL.getSC().getUserNodeId());
        // get the node that holds all blocked users
        SubNode blockedList = svc_user.getBlockedUsers(userName, true);
        List<String> users = XString.tokenize(req.getUserName().trim(), "\n", true);

        users.forEach(u -> {
            blockUser(u, accntIdDoingBlock, blockedList);
        });
        return res;
    }

    private void blockUser(String userToBlock, ObjectId accntIdDoingBlock, SubNode blockedList) {
        AccountNode userNode = svc_friend.findFriendNode(accntIdDoingBlock, null, userToBlock);

        // if we have this node but in some obsolete path delete it. Might be the path of FRIENDS_LIST!
        if (userNode != null && !svc_mongoUtil.isChildOf(blockedList, userNode)) {
            svc_mongoDelete.delete(userNode);
            userNode = null;
        }

        if (userNode == null) {
            userNode = svc_friend.createFriendNode(blockedList, userToBlock, null);
            if (userNode != null) {
                log.debug("Blocked user " + userToBlock);
            }
        }
    }

    public void cm_exportPeople(HttpServletResponse response, String disposition, String listType) {
        try {
            StringBuilder sb = new StringBuilder();
            Criteria moreCriteria = null;
            String fileName = listType.equals(NodeType.FRIEND_LIST.s()) ? "friends.txt" : "blocks.txt";
            List<SubNode> friendNodes =
                    getSpecialNodesList(null, listType, TL.getSC().getUserName(), true, moreCriteria);

            if (friendNodes != null) {
                for (SubNode friendNode : friendNodes) {
                    String userNodeId = friendNode.getStr(NodeProp.USER_NODE_ID);
                    SubNode friendAccountNode = svc_mongoRead.getNodeAP(userNodeId);
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
    public UserProfile getUserProfile(String userId, AccountNode _userNode, boolean abbreviated) {
        String sessionUserName = TL.getSC().getUserName();
        return (UserProfile) svc_arun.run(() -> {
            UserProfile userProfile = null;
            AccountNode userNode = null;
            if (_userNode == null) {
                if (userId == null) {
                    userNode = svc_user.getAccountByUserNameAP(sessionUserName);
                } else {
                    userNode = svc_user.getAccountNodeAP(userId);
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
                userProfile.setUserBio(userNode.getStr(NodeProp.USER_BIO));
                userProfile.setUserTags(userNode.getStr(NodeProp.USER_TAGS));
                userProfile.setBlockedWords(userNode.getStr(NodeProp.USER_BLOCK_WORDS));
                userProfile.setRecentTypes(userNode.getStr(NodeProp.USER_RECENT_TYPES));

                BigDecimal balance = svc_tranRepo.getBalByMongoId(userNode.getIdStr());
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

                if (!abbreviated) {
                    SubNode userHomeNode = svc_mongoRead.getNodeByName(nodeUserName + ":" + Const.HOME_NODE_NAME);
                    if (userHomeNode != null) {
                        userProfile.setHomeNodeId(userHomeNode.getIdStr());
                    }
                    Long followerCount = svc_friend.countFollowersOfUser(sessionUserName, userNode, nodeUserName);
                    userProfile.setFollowerCount(followerCount.intValue());
                    Long followingCount = svc_friend.countFollowingOfUser(sessionUserName, nodeUserName);
                    userProfile.setFollowingCount(followingCount.intValue());
                    if (!TL.getSC().isAnon()) {
                        boolean blocked = userIsBlockedByMe(userNode, nodeUserName);
                        userProfile.setBlocked(blocked);
                        boolean following = userIsFollowedByMe(userNode, nodeUserName);
                        userProfile.setFollowing(following);
                    }
                }
            }
            return userProfile;
        });
    }

    public String getFriendlyNameFromNode(AccountNode userNode) {
        String displayName = userNode.getStr(NodeProp.DISPLAY_NAME);
        if (StringUtils.isEmpty(displayName)) {
            String userName = userNode.getStr(NodeProp.USER);
            if (userName != null) {
                displayName = userName;
            }
        }
        return displayName;
    }

    public boolean userIsFollowedByMe(AccountNode inUserNode, String maybeFollowedUser) {
        String userName = TL.getSC().getUserName();
        SubNode friendsList =
                svc_mongoRead.getUserNodeByType(userName, null, "### Friends", NodeType.FRIEND_LIST.s(), null, false);
        if (friendsList == null)
            return false;
        // note: findFriend() could work here, but findFriend doesn't tell us IF it's INDEED a Friend or
        // Block. Our FRIEND type is used for both Friends and BLOCKs, which is kind of confusing.
        SubNode userNode =
                svc_mongoRead.findNodeByUserAndType(friendsList, inUserNode, maybeFollowedUser, NodeType.FRIEND.s());
        return userNode != null;
    }

    public boolean userIsBlockedByMe(AccountNode inUserNode, String maybeBlockedUser) {
        String userName = TL.getSC().getUserName();
        SubNode blockedList = svc_user.getBlockedUsers(userName, false);
        if (blockedList == null)
            return false;
        // note: findFriend() could work here, but findFriend doesn't tell us IF it's INDEED a Friend or
        // Block.
        // Our FRIEND type is used for both Friends and BLOCKs, which is kind of confusing.
        SubNode userNode =
                svc_mongoRead.findNodeByUserAndType(blockedList, inUserNode, maybeBlockedUser, NodeType.FRIEND.s());
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
        svc_arun.run(() -> {
            SubNode prefsNode = _prefsNode;
            if (prefsNode == null) {
                prefsNode = svc_user.getAccountByUserNameAP(userName);
            }
            userPrefs.setEditMode(prefsNode.getBool(NodeProp.USER_PREF_EDIT_MODE));

            String aiMode = prefsNode.getStr(NodeProp.USER_PREF_AI_MODE);
            if (StringUtils.isEmpty(aiMode)) {
                aiMode = Constant.AI_MODE_CHAT.s();
            }
            userPrefs.setAiMode(aiMode);

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
                aiService = AIModel.OPENAI.s();
            }
            userPrefs.setAiService(aiService);

            String aiAgentFileExtensions = prefsNode.getStr(NodeProp.USER_PREF_AI_FILE_EXTENSIONS);
            if (StringUtils.isEmpty(aiAgentFileExtensions)) {
                aiAgentFileExtensions = "txt,md,html,java,js,ts,css,py,sh,xml,json";
            }
            userPrefs.setAiAgentFileExtensions(aiAgentFileExtensions);
            userPrefs.setAiAgentFoldersToInclude(prefsNode.getStr(NodeProp.USER_PREF_AI_FOLDERS_TO_INCLUDE));

            return null;
        });
        return userPrefs;
    }

    /*
     * Runs when user is doing the 'change password' or 'reset password'
     */
    public ChangePasswordResponse changePassword(ChangePasswordRequest req) {
        MongoTranMgr.ensureTran();
        ChangePasswordResponse res = new ChangePasswordResponse();
        Val<AccountNode> userNode = new Val<>();
        Val<String> userName = new Val<>();
        String passCode = req.getPassCode();
        if (passCode != null) {
            // We can run this block as admin, because the codePart below is secret and is checked for a match
            svc_arun.run(() -> {
                String userNodeId = XString.truncAfterFirst(passCode, "-");
                if (userNodeId == null) {
                    throw new RuntimeEx("Unable to find userNodeId: " + userNodeId);
                }
                userNode.setVal(svc_user.getAccountNode(userNodeId));
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
                userNode.getVal().set(NodeProp.PWD_HASH, svc_mongoUtil.getHashOfPassword(password));
                userNode.getVal().delete(NodeProp.USER_PREF_PASSWORD_RESET_AUTHCODE);
                // note: the adminRunner.run saves the session so we don't do that here.
                return null;
            });
        } else {
            userNode.setVal(svc_user.getAccountByUserNameAP(TL.getSC().getUserName()));
            if (userNode.getVal() == null) {
                throw ExUtil.wrapEx("changePassword cannot find user.");
            }
            if (PrincipalName.ADMIN.s().equals(userName.getVal())) {
                throw new RuntimeEx("changePassword should not be called fror admin user.");
            }
            String password = req.getNewPassword();
            userName.setVal(userNode.getVal().getStr(NodeProp.USER));
            userNode.getVal().set(NodeProp.PWD_HASH, svc_mongoUtil.getHashOfPassword(password));
            userNode.getVal().delete(NodeProp.USER_PREF_PASSWORD_RESET_AUTHCODE);
            svc_mongoUpdate.save(userNode.getVal());
        }
        res.setUser(userName.getVal());
        return res;
    }

    public boolean isNormalUserName(String userName) {
        userName = userName.trim();
        return !userName.equalsIgnoreCase(PrincipalName.ADMIN.s())
                && !userName.equalsIgnoreCase(PrincipalName.ANON.s());
    }

    public ResetPasswordResponse cm_resetPassword(ResetPasswordRequest req) {
        ResetPasswordResponse res = new ResetPasswordResponse();
        svc_arun.run(() -> {
            String user = req.getUser();
            String emailAdr = req.getEmail();
            // make sure username itself is acceptalbe
            if (!isNormalUserName(user)) {
                res.error("User name is illegal.");
                return null;
            }
            AccountNode ownerNode = svc_user.getAccountByUserNameAP(user);
            if (ownerNode == null) {
                res.error("User does not exist.");
                return null;
            }
            // IMPORTANT!
            //
            // verify that the email address provides IS A MATCH to the email address for this user!
            String nodeEmail = ownerNode.getStr(NodeProp.EMAIL);
            if (nodeEmail == null || !nodeEmail.equals(emailAdr)) {
                res.error("Wrong user name and/or email.");
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
            ownerNode.set(NodeProp.USER_PREF_PASSWORD_RESET_AUTHCODE, String.valueOf(authCode));
            svc_mongoUpdate.save(ownerNode);
            String passCode = ownerNode.getIdStr() + "-" + String.valueOf(authCode);
            String link = svc_prop.getHostAndPort() + "?passCode=" + passCode;
            String brandingAppName = svc_prop.getConfigText("brandingAppName");
            String content = //
                    "Password reset was requested on " + brandingAppName + " account: " + user
                            + "<p>\nGo to this link to reset your password: <br>\n" + link;
            svc_email.queueEmail(emailAdr, brandingAppName + " Password Reset", content);
            res.setMessage("A password reset link has been sent to your email. Check your email in a minute or so.");
            return null;
        });
        return res;
    }

    public GetPeopleResponse getPeopleOnNode(String nodeId) {
        GetPeopleResponse res = new GetPeopleResponse();
        SubNode node = svc_mongoRead.getNode(nodeId);
        if (node == null) {
            res.setMessage("Unable to find node.");
            res.setCode(HttpServletResponse.SC_EXPECTATION_FAILED);
        }
        String ownerIdStr = node.getOwner().toHexString();
        HashSet<String> idSet = new HashSet<>();

        List<FriendInfo> friends = new LinkedList<>();
        svc_arun.run(() -> {
            AccountNode ownerAccntNode = svc_user.getAccountNode(node.getOwner());
            if (ownerAccntNode != null) {
                FriendInfo ownerInfo = buildPersonInfoFromAccntNode(ownerAccntNode);
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
                    AccountNode accntNode = svc_user.getAccountNodeAP(accntId);
                    if (accntNode != null) {
                        FriendInfo fi = buildPersonInfoFromAccntNode(accntNode);
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

    public FriendInfo buildPersonInfoFromAccntNode(AccountNode userNode) {
        FriendInfo fi = new FriendInfo();
        String displayName = svc_user.getFriendlyNameFromNode(userNode);
        fi.setUserName(displayName);
        fi.setDisplayName(userNode.getStr(NodeProp.DISPLAY_NAME));
        fi.setUserNodeId(userNode.getIdStr());

        Attachment att = userNode.getAttachment(Constant.ATTACHMENT_PRIMARY.s(), false, false);
        if (att != null) {
            fi.setAvatarVer(att.getBin());
        }

        return fi;
    }

    public GetPeopleResponse getPeople(String userName, String type) {
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
        List<SubNode> friendNodes = getSpecialNodesList(null, nodeType, userName, true, moreCriteria);
        if (friendNodes != null) {
            List<FriendInfo> friends = new LinkedList<>();

            for (SubNode friendNode : friendNodes) {
                FriendInfo fi = svc_friend.buildPersonInfoFromFriendNode(friendNode);
                if (fi != null) {
                    friends.add(fi);
                } else {
                    log.debug("Friend account node is missing. Cleaning up friend id: "
                            + friendNode.getId().toHexString());
                    svc_mongoDelete.adminDelete(friendNode.getId());
                }
            }
            res.setPeople(friends);
        }
        return res;
    }

    public Object cm_getPeople(GetPeopleRequest req) {
        GetPeopleResponse ret = null;
        if (req.getNodeId() != null) {
            ret = svc_user.getPeopleOnNode(req.getNodeId());
        } else {
            ret = svc_user.getPeople(TL.getSC().getUserName(), req.getType());
        }
        ret.setFriendHashTags(svc_userFeed.getFriendsHashTags());
        return ret;
    }

    /**
     * Looks in the userName's account under their 'underType' type node and returns all the children.
     * If userName is passed as null, then we use the currently logged in user
     */
    public List<SubNode> getSpecialNodesList(Val<SubNode> parentNodeVal, String underType, String userName,
            boolean sort, Criteria moreCriteria) {
        List<SubNode> nodeList = new LinkedList<>();
        AccountNode userNode = svc_user.getAccountByUserNameAP(userName);
        if (userNode == null)
            return null;
        SubNode parentNode = svc_mongoRead.findSubNodeByType(userNode, underType);
        if (parentNode == null)
            return null;
        if (parentNodeVal != null) {
            parentNodeVal.setVal(parentNode);
        }
        for (SubNode node : svc_mongoRead.getChildren(parentNode,
                sort ? Sort.by(Sort.Direction.ASC, SubNode.ORDINAL) : null, null, 0, moreCriteria)) {
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

    public String getUserAccountsReport() {
        StringBuilder sb = new StringBuilder();
        long localUserCount = svc_user.getAccountNodeCount(null);
        sb.append("User Count: " + localUserCount + "\n");
        return sb.toString();
    }

    public void updateLastActiveTime(SessionContext sc) {
        svc_arun.run(() -> {
            AccountNode userNode = svc_user.getAccountByUserNameAP(sc.getUserName());
            if (userNode != null) {
                userNode.set(NodeProp.LAST_ACTIVE_TIME, sc.getLastActiveTime());
                svc_mongoUpdate.save(userNode);
            }
            return null;
        });
    }

    public long getUserStorageQuota() {
        if (TL.getSC().isAnon()) {
            return 0;
        }
        if (TL.hasAdminPrivileges()) {
            return Integer.MAX_VALUE;
        }
        AccountNode userNode = svc_user.getAccountByUserNameAP(TL.getSC().getUserName());
        long ret = userNode.getInt(NodeProp.BIN_QUOTA);
        if (ret == 0) {
            return Const.DEFAULT_USER_QUOTA;
        }
        return ret;
    }

    public int getUserStorageRemaining() {
        if (TL.getSC().isAnon()) {
            return 0;
        }
        if (TL.hasAdminPrivileges()) {
            return Integer.MAX_VALUE;
        }
        AccountNode userNode = svc_user.getAccountByUserNameAP(TL.getSC().getUserName());
        if (userNode == null)
            return 0;

        int quota = userNode.getInt(NodeProp.BIN_QUOTA).intValue();
        if (quota == 0) {
            return Const.DEFAULT_USER_QUOTA;
        }
        int binTotal = userNode.getInt(NodeProp.BIN_TOTAL).intValue();
        return quota - binTotal;
    }

    public void logout(HttpSession session) {
        svc_redis.delete(TL.getSC());
        TL.getSC().forceAnonymous();
        session.invalidate();
    }

    public Object cm_getUserProfile(GetUserProfileRequest req) {
        GetUserProfileResponse res = new GetUserProfileResponse();
        UserProfile userProfile = svc_user.getUserProfile(req.getUserId(), null, false);
        if (userProfile != null) {
            res.setUserProfile(userProfile);
        }
        return res;
    }

    public SendFeedbackResponse cm_sendFeedback(SendFeedbackRequest req) {
        return svc_arun.run(() -> {
            SendFeedbackResponse res = new SendFeedbackResponse();
            svc_email.sendDevEmail("Feedback from " + TL.getSC().getUserName(), req.getMessage());
            return res;
        });
    }

    public AccountNode getAccountNode(String id) {
        return svc_ops.findById(new ObjectId(id), AccountNode.class);
    }

    public AccountNode getAccountNodeAP(String id) {
        return svc_arun.run(() -> svc_ops.findById(new ObjectId(id), AccountNode.class));
    }

    public AccountNode getAccountNodeAP(ObjectId id) {
        return svc_arun.run(() -> svc_ops.findById(id, AccountNode.class));
    }

    public AccountNode getAccountNode(ObjectId objId) {
        return svc_ops.findById(objId, AccountNode.class);
    }

    public AccountNode getAccountNodeAP(SubNode node) {
        return svc_arun.run(() -> getAccountNode(node));
    }

    public AccountNode getAccountNode(SubNode node) {
        if (node == null)
            return null;
        return svc_ops.findById(node.getOwner(), AccountNode.class);
    }

    public AccountNode getSessionUserAccount() {
        return getAccountByUserName(TL.getSC().getUserName());
    }

    public AccountNode getAccountByUserNameAP(String user) {
        return svc_arun.run(() -> getAccountByUserName(user));
    }

    public AccountNode getAccountByUserName(String user) {
        if (StringUtils.isEmpty(user)) {
            user = TL.getSC().getUserName();
        }
        user = user.trim();

        // For the ADMIN user their root node is considered to be the entire root of the
        // whole DB
        if (PrincipalName.ADMIN.s().equalsIgnoreCase(user)) {
            return svc_mongoRead.getDbRoot();
        }
        // Otherwise for ordinary users root is based off their username
        // case-insensitive lookup of username:
        Query q = new Query();
        Criteria crit = svc_mongoUtil.childrenCriteria(NodePath.USERS_PATH).and(SubNode.PROPS + "." + NodeProp.USER)
                .is(user).and(SubNode.TYPE).is(NodeType.ACCOUNT.s());

        crit = svc_auth.addReadSecurity(crit);
        q.addCriteria(crit);
        return svc_ops.findUserAccountNode(q);
    }

    public Iterable<SubNode> getAccountNodes(CriteriaDefinition textCriteria, Sort sort, Integer limit, int skip) {
        Query q = new Query();
        Criteria crit = svc_mongoUtil.childrenCriteria(NodePath.USERS_PATH);
        crit = svc_auth.addReadSecurity(crit);
        q.addCriteria(crit);

        if (textCriteria != null) {
            q.addCriteria(textCriteria);
        }
        if (limit != null && limit.intValue() > 0) {
            q.limit(limit.intValue());
        }
        if (skip > 0) {
            q.skip(skip);
        }
        if (sort != null) {
            q.with(sort);
        }
        return svc_ops.find(q);
    }

    public long getAccountNodeCount(CriteriaDefinition textCriteria) {
        Query q = new Query();
        Criteria crit = svc_mongoUtil.childrenCriteria(NodePath.USERS_PATH);
        q.addCriteria(crit);

        if (textCriteria != null) {
            q.addCriteria(textCriteria);
        }
        return svc_ops.count(q);
    }

    /*
     * We create these users just so there's an easy way to start doing multi-user testing (sharing
     * nodes from user to user, etc) without first having to manually register users.
     */
    public void createTestAccounts() {
        // The testUserAccounts is a comma delimited list of user accounts where each user account is a
        // colon-delimited list like username:password:email.
        final List<String> testUserAccountsList = XString.tokenize(svc_prop.getTestUserAccounts(), ",", true);
        if (testUserAccountsList == null) {
            return;
        }
        svc_arun.run(() -> {
            for (String accountInfo : testUserAccountsList) {
                log.debug("Verifying test Account: " + accountInfo);
                final List<String> accountInfoList = XString.tokenize(accountInfo, ":", true);
                if (accountInfoList == null || accountInfoList.size() != 3) {
                    log.debug("Invalid User Info substring: " + accountInfo);
                    continue;
                }
                String userName = accountInfoList.get(0);
                AccountNode ownerNode = svc_user.getAccountByUserNameAP(userName);
                if (ownerNode == null) {
                    log.debug("userName not found: " + userName + ". Account will be created.");
                    SignupRequest signupReq = new SignupRequest();
                    signupReq.setUserName(userName);
                    signupReq.setPassword(accountInfoList.get(1));
                    signupReq.setEmail(accountInfoList.get(2));
                    svc_mongoTrans.cm_signup(signupReq, true);
                } else {
                    log.debug("account exists: " + userName);
                }
                // keep track of these names, because some API methods need to know if a given account is a test
                // account
                testAccountNames.add(userName);
            }
            svc_mongoUpdate.saveSession();
            return null;
        });
    }

    public static boolean isTestAccountName(String userName) {
        return testAccountNames.contains(userName);
    }

    /*
     * Initialize admin user account credentials into repository if not yet done. This should only get
     * triggered the first time the repository is created, the first time the app is started.
     *
     * The admin node is also the repository root node, so it owns all other nodes, by the definition of
     * they way security is inheritive.
     */
    public void createAdminUser() {
        String adminUser = svc_prop.getMongoAdminUserName();
        AccountNode adminNode = svc_user.getAccountByUserNameAP(adminUser);
        if (adminNode == null) {
            adminNode = (AccountNode) svc_snUtil.ensureNodeExists("/", NodePath.ROOT, "Root", NodeType.REPO_ROOT.s(),
                    true, null, null);
            adminNode.set(NodeProp.USER, PrincipalName.ADMIN.s());
            adminNode.set(NodeProp.USER_PREF_EDIT_MODE, false);
            adminNode.set(NodeProp.USER_PREF_AI_MODE, Constant.AI_MODE_CHAT.s());
            adminNode.set(NodeProp.USER_PREF_RSS_HEADINGS_ONLY, true);
            adminNode.set(NodeProp.USER_PREF_SHOW_REPLIES, Boolean.TRUE);
            svc_mongoUpdate.save(adminNode);
        }
        usersNode = svc_snUtil.ensureNodeExists(NodePath.ROOT_PATH, NodePath.USER, "Users", null, true, null, null);
        svc_mongoUtil.createPublicNodes();
    }

    public AccountNode createUser(String newUserName, String email, String password, boolean automated,
            Val<SubNode> postsNodeVal) {
        AccountNode userNode = svc_user.getAccountByUserNameAP(newUserName);
        if (userNode != null) {
            throw new RuntimeException("User already existed: " + newUserName);
        }
        if (PrincipalName.ADMIN.s().equals(newUserName)) {
            throw new RuntimeEx("createUser should not be called for admin user.");
        }
        svc_auth.requireAdmin();
        userNode = (AccountNode) svc_mongoCreate.createNode(usersNode, NodeType.ACCOUNT.s(), null,
                CreateNodeLocation.LAST, true, null);

        usersNode.setHasChildren(true);
        svc_mongoUpdate.saveIfDirtyAP(usersNode);

        ObjectId id = new ObjectId();
        userNode.setId(id);
        userNode.setOwner(id);
        userNode.set(NodeProp.USER, newUserName);
        userNode.set(NodeProp.EMAIL, email);
        userNode.set(NodeProp.PWD_HASH, svc_mongoUtil.getHashOfPassword(password));
        userNode.set(NodeProp.USER_PREF_EDIT_MODE, false);
        userNode.set(NodeProp.USER_PREF_AI_MODE, Constant.AI_MODE_CHAT.s());
        userNode.set(NodeProp.USER_PREF_RSS_HEADINGS_ONLY, true);
        userNode.set(NodeProp.USER_PREF_SHOW_REPLIES, Boolean.TRUE);
        userNode.set(NodeProp.BIN_TOTAL, 0);
        userNode.set(NodeProp.LAST_LOGIN_TIME, 0);
        userNode.set(NodeProp.BIN_QUOTA, Const.DEFAULT_USER_QUOTA);

        userNode.setContent("### Account: " + newUserName);
        userNode.touch();
        if (!automated) {
            userNode.set(NodeProp.SIGNUP_PENDING, true);
        }
        svc_mongoUpdate.save(userNode);

        // ensure we've pre-created this node.
        SubNode postsNode = svc_user.getPostsNode(null, userNode);
        if (postsNodeVal != null) {
            postsNodeVal.setVal(postsNode);
        }

        // ensure this node exists, by calling the getter (but we don't need the return value)
        svc_user.getNotesNode(null, userNode);
        svc_mongoUpdate.save(userNode);
        return userNode;
    }
}
