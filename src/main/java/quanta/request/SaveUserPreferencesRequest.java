package quanta.request;

import quanta.model.UserPreferences;
import quanta.request.base.RequestBase;

public class SaveUserPreferencesRequest extends RequestBase {
	private String userNodeId;
	private UserPreferences userPreferences;

	public UserPreferences getUserPreferences() {
		return userPreferences;
	}

	public void setUserPreferences(UserPreferences userPreferences) {
		this.userPreferences = userPreferences;
	}

	public String getUserNodeId() {
		return userNodeId;
	}

	public void setUserNodeId(String userNodeId) {
		this.userNodeId = userNodeId;
	}
}
