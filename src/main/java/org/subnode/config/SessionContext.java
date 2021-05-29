package org.subnode.config;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Random;
import java.util.TimeZone;
import javax.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Scope;
import org.springframework.context.annotation.ScopedProxyMode;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.subnode.model.UserPreferences;
import org.subnode.model.client.PrincipalName;
import org.subnode.mongo.MongoUtil;
import org.subnode.request.base.RequestBase;
import org.subnode.service.UserManagerService;
import org.subnode.util.DateUtil;

/**
 * The ScopedProxyMode.TARGET_CLASS annotation allows this session bean to be available on
 * singletons or other beans that are not themselves session scoped.
 */
@Component
@Scope(value = "session", proxyMode = ScopedProxyMode.TARGET_CLASS)
public class SessionContext {
	private static final Logger log = LoggerFactory.getLogger(SessionContext.class);

	@Autowired
	private UserManagerService userManagerService;

	/* Identification of user's account root node */
	private String rootId;

	/* When the user does a "Timeline" search we store the path of the node the timeline was done on
	so that with a simple substring search, we can detect any time a new node is added that would've appeared
	in the timeline and then do a server push to browsers of any new nodes, thereby creating a realtime
	view of the timeline, making it become like a "chat room" */
	private String timelinePath;

	private String userName;
	private String password;
	private String timezone;
	private String timeZoneAbbrev;

	// variable not currently being used (due to refactoring)
	private long lastLoginTime;
	private long lastActiveTime;

	private UserPreferences userPreferences;

	/* Note: this object is Session-specific to the timezone will be per user */
	private SimpleDateFormat dateFormat;

	/* Initial id param parsed from first URL request */
	private String urlId;

	public int counter;

	/* Emitter for sending push notifications to the client */
	private SseEmitter pushEmitter;

	// this one WILL work with multiple sessions per user
	public static final HashSet<SessionContext> allSessions = new HashSet<>();

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

	private static final Random rand = new Random();
	private String userToken = String.valueOf(rand.nextInt());

	public SessionContext() {
		log.trace(String.format("Creating Session object hashCode[%d]", hashCode()));
		synchronized (allSessions) {
			allSessions.add(this);
		}
	}

	public void init(RequestBase req) {
		setTimezone(DateUtil.getTimezoneFromOffset(req.getTzOffset()));
		setTimeZoneAbbrev(DateUtil.getUSTimezone(-req.getTzOffset() / 60, req.getDst()));
	}

	public static boolean validToken(String token) {
		if (token == null)
			return false;

		for (SessionContext sc : allSessions) {
			if (token.equals(sc.getUserToken())) {
				return true;
			}
		}
		return false;
	}

	public String getUserToken() {
		return userToken;
	}

	public static List<SessionContext> getSessionsByUserName(String userName) {
		if (userName == null)
			return null;

		List<SessionContext> list = null;

		for (SessionContext sc : allSessions) {
			if (userName.equals(sc.getUserName())) {
				if (list == null) {
					list = new LinkedList<SessionContext>();
				}
				list.add(sc);
			}
		}
		return list;
	}

	@PreDestroy
	public void preDestroy() {
		log.trace(String.format("Destroying Session object hashCode[%d] of user %s", hashCode(), userName));

		synchronized (allSessions) {
			userManagerService.updateLastActiveTime(this);
			allSessions.remove(this);
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
			if (dateFormat == null) {
				dateFormat = new SimpleDateFormat(DateUtil.DATE_FORMAT_NO_TIMEZONE, DateUtil.DATE_FORMAT_LOCALE);
				if (getTimezone() != null) {
					dateFormat.setTimeZone(TimeZone.getTimeZone(getTimezone()));
				}
			}
			return dateFormat.format(date) + " " + getTimeZoneAbbrev();
		}
		/* else display timezone in standard GMT format */
		else {
			if (dateFormat == null) {
				dateFormat = new SimpleDateFormat(DateUtil.DATE_FORMAT_WITH_TIMEZONE, DateUtil.DATE_FORMAT_LOCALE);
				if (getTimezone() != null) {
					dateFormat.setTimeZone(TimeZone.getTimeZone(getTimezone()));
				}
			}
			return dateFormat.format(date);
		}
	}

	/*
	 * This can create nasty bugs. I should be always getting user name from the actual session object
	 * itself in all the logic... in most every case except maybe login process.
	 */
	public String getUserName() {
		return userName;
	}

	public void setUserName(String userName) {
		this.userName = userName;
	}

	public String getPassword() {
		return password;
	}

	public void setPassword(String password) {
		this.password = password;
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
}
