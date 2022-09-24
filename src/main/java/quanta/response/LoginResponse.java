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
	private UserPreferences userPreferences;
	private boolean allowFileSystemSearch;

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
}
