package org.subnode.request;

import org.subnode.request.base.RequestBase;

public class ChangePasswordRequest extends RequestBase {
	private String newPassword;

	/* passCode is only used during a Password Reset (not used during normal Change Password) */
	private String passCode;

	public String getNewPassword() {
		return newPassword;
	}

	public void setNewPassword(String newPassword) {
		this.newPassword = newPassword;
	}

	public String getPassCode() {
		return passCode;
	}

	public void setPassCode(String passCode) {
		this.passCode = passCode;
	}
}
