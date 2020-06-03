package org.subnode.response;

import org.subnode.response.base.ResponseBase;

public class GetUserProfileResponse extends ResponseBase {
    private String userName;
	private String userBio;

	// version (which is now just the GRID ID) needed to retrieve profile image (account node binary attachment)
	// Moving out of here into getUserProfile
	private String avatarVer;

	private String userNodeId;

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
}
