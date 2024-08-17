
package quanta.rest.response;

import quanta.model.client.UserProfile;
import quanta.rest.response.base.ResponseBase;

public class GetUserProfileResponse extends ResponseBase {
	private UserProfile userProfile;
	
	public UserProfile getUserProfile() {
		return this.userProfile;
	}
	
	public void setUserProfile(final UserProfile userProfile) {
		this.userProfile = userProfile;
	}

	public GetUserProfileResponse() {
	}
}
