package quanta.response;

import quanta.model.client.UserProfile;
import quanta.response.base.ResponseBase;

public class GetUserProfileResponse extends ResponseBase {
	private UserProfile userProfile;

	public UserProfile getUserProfile() {
		return userProfile;
	}

	public void setUserProfile(UserProfile userProfile) {
		this.userProfile = userProfile;
	}
}
