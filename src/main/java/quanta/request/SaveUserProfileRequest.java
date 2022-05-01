package quanta.request;

import quanta.request.base.RequestBase;

public class SaveUserProfileRequest extends RequestBase {
	private String userName;
	private String userBio;
	private String userTags;
	private String displayName;

	// only publishes DID/IPNS if this is true
	private boolean publish;

	public String getUserName() {
		return userName;
	}

	public String getUserBio() {
		return userBio;
	}

	public void setUserBio(String userBio) {
		this.userBio = userBio;
	}

	public String getUserTags() {
		return userTags;
	}

	public void setUserTags(String userTags) {
		this.userTags = userTags;
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

	public boolean isPublish() {
		return publish;
	}

	public void setPublish(boolean publish) {
		this.publish = publish;
	}
}
