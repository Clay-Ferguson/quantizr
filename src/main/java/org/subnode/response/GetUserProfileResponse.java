package org.subnode.response;

import org.subnode.response.base.ResponseBase;

public class GetUserProfileResponse extends ResponseBase {
    private String userName;
	private String userBio;

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
}
