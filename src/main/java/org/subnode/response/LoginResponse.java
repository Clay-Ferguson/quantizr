package org.subnode.response;

import org.subnode.model.UserPreferences;
import org.subnode.response.base.ResponseBase;

public class LoginResponse extends ResponseBase {

	// Node Id of user account logged in.
	private String rootNode;

	private String rootNodePath;

	/* will be username or 'anonymous' if server rejected login */
	private String userName;
	private String displayName;

	private String anonUserLandingPageNode;

	/*
	 * we can optionally send back something here to force the client to load the specified node instead
	 * of whatever other node it would have loaded for whatever series of reasons. This is a hard
	 * override for anything else.
	 */
	private String homeNodeOverride;

	private UserPreferences userPreferences;

	private boolean allowFileSystemSearch;

	public String getUserName() {
		return userName;
	}

	public void setUserName(String userName) {
		this.userName = userName;
	}

	public String getDisplayName() {
		return displayName;
	}

	public void setDisplayName(String displayName) {
		this.displayName = displayName;
	}

	public String getRootNode() {
		return rootNode;
	}

	public void setRootNode(String rootNode) {
		this.rootNode = rootNode;
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
}
