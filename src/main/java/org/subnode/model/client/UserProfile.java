package org.subnode.model.client;

public class UserProfile {
    private String userName;
	private String userBio;

	// version (which is now just the GRID ID) needed to retrieve profile image (account node binary attachment)
	// Moving out of here into getUserProfile
	private String avatarVer;

	private String headerImageVer;

	private String userNodeId;

	/* for foreign users this will point to their user avatar image */
	private String apIconUrl;

	/* for foreign users this will be their actor url */
	private String actorUrl;
    
	public String getUserName() {
		return userName;
	}

	public String getUserBio() {
		return userBio;
	}

	public void setUserBio(String userBio) {
		this.userBio = userBio;
	}

	public void setUserName(String userName) {
		this.userName = userName;
	}

	public String getAvatarVer() {
		return avatarVer;
	}

	public void setAvatarVer(String avatarVer) {
		this.avatarVer = avatarVer;
	}

	public String getUserNodeId() {
		return this.userNodeId;
	}

	public void setUserNodeId(String userNodeId) {
		this.userNodeId = userNodeId;
	}

	public String getHeaderImageVer() {
		return headerImageVer;
	}

	public void setHeaderImageVer(String headerImageVer) {
		this.headerImageVer = headerImageVer;
	}

	public String getApIconUrl() {
		return apIconUrl;
	}

	public void setApIconUrl(String apIconUrl) {
		this.apIconUrl = apIconUrl;
	}

	public String getActorUrl() {
		return actorUrl;
	}

	public void setActorUrl(String actorUrl) {
		this.actorUrl = actorUrl;
	}
}
