package org.subnode.request;

import org.subnode.request.base.RequestBase;

public class SaveUserProfileRequest extends RequestBase {
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
