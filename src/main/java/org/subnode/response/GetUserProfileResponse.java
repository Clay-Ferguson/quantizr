package org.subnode.response;

import org.subnode.model.client.UserProfile;
import org.subnode.response.base.ResponseBase;

public class GetUserProfileResponse extends ResponseBase {
	private UserProfile userProfile;

	public UserProfile getUserProfile() {
		return userProfile;
	}

	public void setUserProfile(UserProfile userProfile) {
		this.userProfile = userProfile;
	}
}
