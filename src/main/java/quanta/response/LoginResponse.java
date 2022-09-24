package quanta.response;

import quanta.model.UserPreferences;
import quanta.model.client.UserProfile;
import quanta.response.base.ResponseBase;

public class LoginResponse extends ResponseBase {

	// now that we have userProfile in this object (a new change) some of the other properties
	// should be redundant and can be removed
	private UserProfile userProfile;

	private String authToken;
	private String rootNodePath;
	private String allowedFeatures;

	private String anonUserLandingPageNode;

	/*
	 * we can optionally send back something here to force the client to load the specified node instead
	 * of whatever other node it would have loaded for whatever series of reasons. This is a hard
	 * override for anything else.
	 */
	private String homeNodeOverride;

	private UserPreferences userPreferences;

	private boolean allowFileSystemSearch;

	private String accessFailMsg;

	public UserProfile getUserProfile() {
		return userProfile;
	}

	public void setUserProfile(UserProfile userProfile) {
		this.userProfile = userProfile;
	}

	public String getRootNodePath() {
		return rootNodePath;
	}

	public void setRootNodePath(String rootNodePath) {
		this.rootNodePath = rootNodePath;
	}

	public String getAnonUserLandingPageNode() {
		return anonUserLandingPageNode;
	}

	public void setAnonUserLandingPageNode(String anonUserLandingPageNode) {
		this.anonUserLandingPageNode = anonUserLandingPageNode;
	}

	public String getHomeNodeOverride() {
		return homeNodeOverride;
	}

	public void setHomeNodeOverride(String homeNodeOverride) {
		this.homeNodeOverride = homeNodeOverride;
	}

	public UserPreferences getUserPreferences() {
		return userPreferences;
	}

	public void setUserPreferences(UserPreferences userPreferences) {
		this.userPreferences = userPreferences;
	}

	public boolean isAllowFileSystemSearch() {
		return allowFileSystemSearch;
	}

	public void setAllowFileSystemSearch(boolean allowFileSystemSearch) {
		this.allowFileSystemSearch = allowFileSystemSearch;
	}

	public String getAuthToken() {
		return authToken;
	}

	public void setAuthToken(String authToken) {
		this.authToken = authToken;
	}

	public String getAllowedFeatures() {
		return allowedFeatures;
	}

	public void setAllowedFeatures(String allowedFeatures) {
		this.allowedFeatures = allowedFeatures;
	}

	public String getAccessFailMsg() {
		return accessFailMsg;
	}

	public void setAccessFailMsg(String accessFailMsg) {
		this.accessFailMsg = accessFailMsg;
	}
}
