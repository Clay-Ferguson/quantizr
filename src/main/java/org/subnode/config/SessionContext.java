package org.subnode.config;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.TimeZone;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Scope;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.subnode.model.UserPreferences;
import org.subnode.model.client.PrincipalName;
import org.subnode.mongo.MongoAuth;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoUtil;
import org.subnode.mongo.model.SubNode;
import org.subnode.response.SessionTimeoutPushInfo;
import org.subnode.service.PushService;
import org.subnode.util.DateUtil;
import org.subnode.util.StopwatchEntry;
import org.subnode.util.ThreadLocals;
import org.subnode.util.Util;

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

	/*
	 * If this time is non-null it represents the newest time on the first node of the first page of
	 * results the last time query query for the first page (page=0) was done. We use this so that in
	 * case the database is updated with new results, none of those results can alter the pagination and
	 * the pagination will be consistent until the user clicks refresh feed again. The case we are
	 * avoiding is for example when user clicks 'more' to go to page 2, if the database had updated then
	 * even on page 2 they may be seeing some records they had already seen on page 1
	 */
	private Date feedMaxTime;

	private String userToken;

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
		sc.feedMaxTime = feedMaxTime;
		sc.userToken = userToken;
		sc.watchingPath = watchingPath;

		return sc;
	}

	public List<StopwatchEntry> getStopwatchData() {
		return stopwatchData;
	}

	public void addAction(String actionName) {
		Integer count = actionCounters.get(actionName);
		if (count == null) {
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

		if (userToken == null) {
			userToken = Util.genStrongToken();
		}
		log.debug("sessionContext authenticated hashCode=" + String.valueOf(hashCode()) + " user: " + userName + " to userToken "
				+ userToken);
		setUserName(userName);

		if (userNodeId == null) {
			SubNode userNode = read.getUserNodeByUserName(auth.getAdminSession(), userName);
			// we found user's node.
			if (userNode != null) {
				setUserNodeId(userNode.getId());
			} else {
				throw new RuntimeException("No userNode found for user: " + userName);
			}
		} else {
			setUserNodeId(userNodeId);
		}
	}

	public boolean isAuthenticated() {
		return userToken != null;
	}

	/*
	 * We rely on the secrecy and unguessability of the token here, but eventually this will become JWT
	 * and perhaps use Spring Security
	 */
	public static boolean validToken(String token, String userName) {
		if (token == null)
			return false;

		synchronized (allSessions) {
			for (SessionContext sc : allSessions) {
				if (token.equals(sc.getUserToken())) {
					if (userName != null) {
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
				if (sc.isLive() && sc.getUserToken() != null) {
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
		if (userName == null)
			return null;

		List<SessionContext> list = null;
		synchronized (allSessions) {
			for (SessionContext sc : allSessions) {
				if (userName.equals(sc.getUserName())) {
					if (list == null) {
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
			 * userManagerService.updateLastActiveTime(this);
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

	public String formatTimeForUserTimezone(Date date) {
		if (date == null)
			return null;

		/* If we have a short timezone abbreviation display timezone with it */
		if (getTimeZoneAbbrev() != null) {
			SimpleDateFormat dateFormat = new SimpleDateFormat(DateUtil.DATE_FORMAT_NO_TIMEZONE, DateUtil.DATE_FORMAT_LOCALE);
			if (getTimezone() != null) {
				dateFormat.setTimeZone(TimeZone.getTimeZone(getTimezone()));
			}
			return dateFormat.format(date) + " " + getTimeZoneAbbrev();
		}
		/* else display timezone in standard GMT format */
		else {
			SimpleDateFormat dateFormat = new SimpleDateFormat(DateUtil.DATE_FORMAT_WITH_TIMEZONE, DateUtil.DATE_FORMAT_LOCALE);
			if (getTimezone() != null) {
				dateFormat.setTimeZone(TimeZone.getTimeZone(getTimezone()));
			}
			return dateFormat.format(date);
		}
	}

	public String getUserName() {
		return userName;
	}

	public void setUserName(String userName) {
		if (userName != null) {
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

	public Date getFeedMaxTime() {
		return feedMaxTime;
	}

	public void setFeedMaxTime(Date feedMaxTime) {
		this.feedMaxTime = feedMaxTime;
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
		if (userName == null || !userName.equals(PrincipalName.ADMIN.s()))
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
