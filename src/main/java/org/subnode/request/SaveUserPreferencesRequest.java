package org.subnode.request;

import org.subnode.model.UserPreferences;
import org.subnode.request.base.RequestBase;

public class SaveUserPreferencesRequest extends RequestBase {
	private UserPreferences userPreferences;

	public UserPreferences getUserPreferences() {
		return userPreferences;
	}

	public void setUserPreferences(UserPreferences userPreferences) {
		this.userPreferences = userPreferences;
	}
}
