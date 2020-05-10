package org.subnode.config;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.TimeZone;

import javax.annotation.PreDestroy;
import javax.servlet.http.HttpSession;

import org.subnode.model.UserPreferences;
import org.subnode.model.client.PrincipalName;
import org.subnode.mongo.RepositoryUtil;
import org.subnode.util.DateUtil;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Scope;
import org.springframework.context.annotation.ScopedProxyMode;
import org.springframework.stereotype.Component;

/**
 * Wrapper for holding variables that we need to maintain server state of for a
 * session. Basic session state storage is all collected here.
 * 
 * The ScopedProxyMode.TARGET_CLASS annotation allows this session bean to be
 * available on singletons or other beans that are not themselves session
 * scoped.
 */
@Component
@Scope(value = "session", proxyMode = ScopedProxyMode.TARGET_CLASS)
public class SessionContext {
	private static final Logger log = LoggerFactory.getLogger(SessionContext.class);

	@Autowired
	RepositoryUtil repoUtil;

	private String error;

	/* Identification of user's account root node */
	// private Ref_Info rootRef_Info;
	private String rootId;

	private String userName;
	private String password;
	private String timezone;
	private String timeZoneAbbrev;

	private UserPreferences userPreferences;

	private String signupSuccessMessage;

	/* Note: this object is Session-specific to the timezone will be per user */
	private SimpleDateFormat dateFormat;

	/* Initial id param parsed from first URL request */
	private String urlId;

	public int counter;

	private HttpSession httpSessionToInvalidate;

	public SessionContext() {
		log.trace(String.format("Creating Session object hashCode[%d]", hashCode()));
	}

	@PreDestroy
	public void preDestroy() {
		log.trace(String.format("Destroying Session object hashCode[%d] of user %s", hashCode(), userName));
	}

	public boolean isAdmin() {
		return PrincipalName.ADMIN.s().equalsIgnoreCase(userName);
	}

	public boolean isAnonUser() {
		return PrincipalName.ANON.s().equalsIgnoreCase(userName);
	}

	public boolean isTestAccount() {
		return repoUtil.isTestAccountName(userName);
	}

	public String formatTime(Date date) {
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
	 * This can create nasty bugs. I should be always getting user name from the
	 * actual session object itself in all the logic... in most every case except
	 * maybe login process.
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

	public HttpSession getHttpSessionToInvalidate() {
		return httpSessionToInvalidate;
	}

	public void setHttpSessionToInvalidate(HttpSession httpSessionToInvalidate) {
		this.httpSessionToInvalidate = httpSessionToInvalidate;
	}

	public String getSignupSuccessMessage() {
		return signupSuccessMessage;
	}

	public void setSignupSuccessMessage(String signupSuccessMessage) {
		this.signupSuccessMessage = signupSuccessMessage;
	}

	public String getError() {
		return error;
	}

	public void setError(String error) {
		this.error = error;
	}
}
