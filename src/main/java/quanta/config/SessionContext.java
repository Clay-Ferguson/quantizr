package quanta.config;

import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import javax.servlet.http.HttpSession;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Scope;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import quanta.model.UserPreferences;
import quanta.model.client.PrincipalName;
import quanta.mongo.MongoAuth;
import quanta.mongo.MongoRead;
import quanta.mongo.MongoUtil;
import quanta.mongo.model.SubNode;
import quanta.response.SessionTimeoutPushInfo;
import quanta.service.PushService;
import quanta.util.StopwatchEntry;
import quanta.util.ThreadLocals;
import quanta.util.Util;
import static quanta.util.Util.*;

/**
 * Session object holding state per user session.
 */
@Component
@Scope("prototype")
public class SessionContext {
	// DO NOT DELETE (keep for future ref)
	// implements InitializingBean, DisposableBean {
	private static final Logger log = LoggerFactory.getLogger(SessionContext.class);

	public static final String QSC = "QSC";
	private boolean live = true;

	@Autowired
	private PushService pushService;

	@Autowired
	private MongoAuth auth;

	@Autowired
	private MongoRead read;

	/* Identification of user's account root node. */
	private String rootId;

	/*
	 * When the user does a "Timeline" search we store the path of the node the timeline was done on so
	 * that with a simple substring search, we can detect any time a new node is added that would've
	 * appeared in the timeline and then do a server push to browsers of any new nodes, thereby creating
	 * a realtime view of the timeline, making it become like a "chat room"
	 */
	private String timelinePath;

	private String userName = PrincipalName.ANON.s();
	private ObjectId userNodeId;
	private String pastUserName = userName;
	private String ip;
	private String timezone;
	private String timeZoneAbbrev;

	// variable not currently being used (due to refactoring)
	private long lastLoginTime;
	private long lastActiveTime;

	private UserPreferences userPreferences;

	/* Initial id param parsed from first URL request */
	private String urlId;

	public int counter;

	/* Emitter for sending push notifications to the client */
	private SseEmitter pushEmitter = new SseEmitter();

	// this one WILL work with multiple sessions per user
	private static final HashSet<SessionContext> allSessions = new HashSet<>();

	// Full list of active and inactive (dead) sessions.
	public static final HashSet<SessionContext> historicalSessions = new HashSet<>();

	/* keeps track of total calls to each URI */
	public HashMap<String, Integer> actionCounters = new HashMap<>();

	public List<StopwatchEntry> stopwatchData = new LinkedList<>();

	private String captcha;
	private int captchaFails = 0;

	private String userToken;
	private boolean enableIPSM;

	public boolean isEnableIPSM() {
		return enableIPSM;
	}

	public void setEnableIPSM(boolean enableIPSM) {
		this.enableIPSM = enableIPSM;
	}

	/*
	 * When the user is viewing the Node Feed for a specific node, this will be the path of that root
	 * node, and we use this so we can easily do a 'browser push' to any user whenever something new is
	 * created under a that feed. todo-1: we could rename this to "chatNodePath", because it's basically
	 * the chat node when the user is in a chat room.
	 */
	private String watchingPath;

	public SessionContext() {
		log.trace(String.format("Creating Session object hashCode[%d]", hashCode()));

		synchronized (allSessions) {
			allSessions.add(this);
		}
		synchronized (historicalSessions) {
			historicalSessions.add(this);
		}
	}

	public static SessionContext init(HttpSession session) {
		// Ensure we have a Quanta Session Context
		SessionContext sc = (SessionContext) session.getAttribute(SessionContext.QSC);

		// if we don't have a SessionContext yet or it timed out then create a new one.
		if (no(sc) || !sc.isLive()) {
			/*
			 * Note: we create SessionContext objects here on some requests that don't need them, but that's ok
			 * becasue all our code makes the assumption there will be a SessionContext on the thread.
			 * log.debug("Creating new session at req "+httpReq.getRequestURI());
			 */
			sc = (SessionContext) SpringContextUtil.getBean(SessionContext.class);
			session.setAttribute(SessionContext.QSC, sc);
		}
		ThreadLocals.setSC(sc);
		return sc;
	}

	/* Extra layer of security to invalidate this session object */
	public void forceAnonymous() {
		userToken = null;
		userName = PrincipalName.ANON.s();
		rootId = null;
		userNodeId = null;
		timelinePath = null;
		watchingPath = null;
	}

	/* Creates a new instance that inherits all the values that could be used by a different thread */
	public SessionContext cloneForThread() {
		SessionContext sc = (SessionContext) SpringContextUtil.getBean(SessionContext.class);
		sc.live = live;
		sc.rootId = rootId;
		sc.timelinePath = timelinePath;
		sc.userName = userName;
		sc.userNodeId = userNodeId;
		sc.pastUserName = pastUserName;
		sc.ip = ip;
		sc.timezone = timezone;
		sc.timeZoneAbbrev = timeZoneAbbrev;
		sc.lastLoginTime = lastLoginTime;
		sc.lastActiveTime = lastActiveTime;
		sc.userPreferences = userPreferences;
		sc.urlId = urlId;
		sc.counter = counter;
		sc.pushEmitter = pushEmitter;
		sc.actionCounters = new HashMap<>();
		sc.stopwatchData = new LinkedList<>();
		sc.captcha = captcha;
		sc.captchaFails = captchaFails;
		sc.userToken = userToken;
		sc.watchingPath = watchingPath;
		sc.enableIPSM = enableIPSM;
		return sc;
	}

	public List<StopwatchEntry> getStopwatchData() {
		return stopwatchData;
	}

	public void addAction(String actionName) {
		Integer count = actionCounters.get(actionName);
		if (no(count)) {
			actionCounters.put(actionName, 1);
		} else {
			actionCounters.put(actionName, count.intValue() + 1);
		}
	}

	public String dumpActions(String prefix, int countThreshold) {
		StringBuilder sb = new StringBuilder();
		for (String actionName : actionCounters.keySet()) {
			Integer count = (Integer) actionCounters.get(actionName);
			if (count.intValue() >= countThreshold) {
				sb.append(prefix);
				sb.append(actionName);
				sb.append(" ");
				sb.append(String.valueOf(count));
				sb.append("\n");
			}
		}
		return sb.toString();
	}

	/* This is called only upon successful login of a non-anon user */
	public void setAuthenticated(String userName, ObjectId userNodeId) {
		if (userName.equals(PrincipalName.ANON.s())) {
			throw new RuntimeException("invalid call to setAuthenticated for anon.");
		}

		if (no(userToken)) {
			userToken = Util.genStrongToken();
		}
		log.debug("sessionContext authenticated hashCode=" + String.valueOf(hashCode()) + " user: " + userName + " to userToken "
				+ userToken);
		setUserName(userName);

		if (no(userNodeId)) {
			SubNode userNode = read.getUserNodeByUserName(auth.getAdminSession(), userName);
			// we found user's node.
			if (ok(userNode)) {
				setUserNodeId(userNode.getId());
			} else {
				throw new RuntimeException("No userNode found for user: " + userName);
			}
		} else {
			setUserNodeId(userNodeId);
		}
	}

	public boolean isAuthenticated() {
		return ok(userToken);
	}

	/*
	 * We rely on the secrecy and unguessability of the token here, but eventually this will become JWT
	 * and perhaps use Spring Security
	 */
	public static boolean validToken(String token, String userName) {
		if (no(token))
			return false;

		synchronized (allSessions) {
			for (SessionContext sc : allSessions) {
				if (token.equals(sc.getUserToken())) {
					if (ok(userName)) {
						// need to add IP check here too, but IP can be spoofed?
						return userName.equals(sc.getUserName());
					} else {
						return true;
					}
				}
			}
		}
		return false;
	}

	public String getUserToken() {
		return userToken;
	}

	/*
	 * UPDATE: This is simply happening becasue the WebFilter is not able to detect when something is a
	 * static file and so it generates SessionContext on every session it sees.
	 */
	public static List<SessionContext> getAllSessions() {
		List<SessionContext> ret = new LinkedList<>();
		HashSet<String> tokens = new HashSet<>();
		synchronized (allSessions) {
			for (SessionContext sc : allSessions) {
				if (sc.isLive() && ok(sc.getUserToken())) {
					if (!tokens.contains(sc.getUserToken())) {
						ret.add(sc);
						tokens.add(sc.getUserToken());
					}
				}
			}
		}
		return ret;
	}

	public static List<SessionContext> getHistoricalSessions() {
		synchronized (historicalSessions) {
			return new LinkedList<>(historicalSessions);
		}
	}

	public static List<SessionContext> getSessionsByUserName(String userName) {
		if (no(userName))
			return null;

		List<SessionContext> list = null;
		synchronized (allSessions) {
			for (SessionContext sc : allSessions) {
				if (userName.equals(sc.getUserName())) {
					if (no(list)) {
						list = new LinkedList<>();
					}
					list.add(sc);
				}
			}
		}
		return list;
	}

	public void sessionTimeout() {
		log.trace(String.format("Destroying Session object hashCode[%d] of user %s", hashCode(), userName));
		pushService.sendServerPushInfo(this, new SessionTimeoutPushInfo());

		synchronized (allSessions) {
			/*
			 * This "lastActiveTime", should really be called "last message checked time", becaues that's the
			 * purpose it serves, so I think setting this here is undesirable, but we should only reset when the
			 * user is really checking their messages (like in UserFeedService), where this logic was moved to.
			 * usrMgr.updateLastActiveTime(this);
			 */
			allSessions.remove(this);
			setLive(false);
		}
	}

	public boolean isAdmin() {
		return PrincipalName.ADMIN.s().equalsIgnoreCase(userName);
	}

	public boolean isAnonUser() {
		return PrincipalName.ANON.s().equalsIgnoreCase(userName);
	}

	public boolean isTestAccount() {
		return MongoUtil.isTestAccountName(userName);
	}

	public String getUserName() {
		return userName;
	}

	public void setUserName(String userName) {
		if (ok(userName)) {
			pastUserName = userName;
		}
		this.userName = userName;
	}

	public String getPastUserName() {
		return pastUserName;
	}

	public void setPastUserName(String pastUserName) {
		this.pastUserName = pastUserName;
	}

	public String getUrlId() {
		return urlId;
	}

	public void setUrlId(String urlId) {
		this.urlId = urlId;
	}

	public String getTimezone() {
		return timezone;
	}

	public void setTimezone(String timezone) {
		this.timezone = timezone;
	}

	public String getTimeZoneAbbrev() {
		return timeZoneAbbrev;
	}

	public void setTimeZoneAbbrev(String timeZoneAbbrev) {
		this.timeZoneAbbrev = timeZoneAbbrev;
	}

	public String getRootId() {
		return rootId;
	}

	public void setRootId(String rootId) {
		this.rootId = rootId;
	}

	public UserPreferences getUserPreferences() {
		return userPreferences;
	}

	public void setUserPreferences(UserPreferences userPreferences) {
		this.userPreferences = userPreferences;
	}

	public long getLastLoginTime() {
		return lastLoginTime;
	}

	public void setLastLoginTime(long lastLoginTime) {
		this.lastLoginTime = lastLoginTime;
	}

	public long getLastActiveTime() {
		return lastActiveTime;
	}

	public void setLastActiveTime(long lastActiveTime) {
		this.lastActiveTime = lastActiveTime;
	}

	public SseEmitter getPushEmitter() {
		return pushEmitter;
	}

	public void setPushEmitter(SseEmitter pushEmitter) {
		this.pushEmitter = pushEmitter;
	}

	public String getCaptcha() {
		return captcha;
	}

	public void setCaptcha(String captcha) {
		this.captcha = captcha;
	}

	public int getCaptchaFails() {
		return captchaFails;
	}

	public void setCaptchaFails(int captchaFails) {
		this.captchaFails = captchaFails;
	}

	public String getTimelinePath() {
		return timelinePath;
	}

	public void setTimelinePath(String timelinePath) {
		this.timelinePath = timelinePath;
	}

	public String getIp() {
		return ip;
	}

	public void setIp(String ip) {
		this.ip = ip;
	}

	public boolean isLive() {
		return live;
	}

	public void setLive(boolean live) {
		this.live = live;
	}

	// DO NOT DELETE: Keep for future reference
	// // from DisposableBean interface
	// @Override
	// public void destroy() throws Exception {
	// //log.debug("SessionContext destroy hashCode=" + String.valueOf(hashCode()) + ": userName=" +
	// this.userName);
	// }

	// // From InitializingBean interface
	// @Override
	// public void afterPropertiesSet() throws Exception {}

	public void stopwatch(String action) {
		// for now only admin user has stopwatch capability
		if (no(userName) || !userName.equals(PrincipalName.ADMIN.s()))
			return;

		StopwatchEntry se = null;

		String threadName = Thread.currentThread().getName();
		threadName = threadName.replace("https-jsse-nio-443-exec-", "T");

		if (ThreadLocals.getStopwatchTime() == -1) {
			se = new StopwatchEntry(action, -1, threadName);
			log.debug("Stopwatch: " + action);
		} else {
			Integer duration = (int) (System.currentTimeMillis() - ThreadLocals.getStopwatchTime());
			se = new StopwatchEntry(action, duration, threadName);
			log.debug("Stopwatch: " + action + " elapsed: " + String.valueOf(duration) + "ms");
		}

		synchronized (stopwatchData) {
			stopwatchData.add(se);
		}
		ThreadLocals.setStopwatchTime(System.currentTimeMillis());
	}

	public String getWatchingPath() {
		return watchingPath;
	}

	public void setWatchingPath(String watchingPath) {
		this.watchingPath = watchingPath;
	}

	public ObjectId getUserNodeId() {
		return userNodeId;
	}

	public void setUserNodeId(ObjectId userNodeId) {
		this.userNodeId = userNodeId;
	}
}
