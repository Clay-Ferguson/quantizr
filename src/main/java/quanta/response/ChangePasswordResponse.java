package quanta.response;

import quanta.response.base.ResponseBase;

public class ChangePasswordResponse extends ResponseBase {

	/*
	 * Whenever a password reset is being done, the user will be sent back to the browser in this
	 * var
	 */
	private String user;

	public String getUser() {
		return user;
	}

	public void setUser(String user) {
		this.user = user;
	}
}
