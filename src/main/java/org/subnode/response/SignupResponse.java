package org.subnode.response;

import org.subnode.response.base.ResponseBase;

public class SignupResponse extends ResponseBase {
    private String userError;
    private String passwordError;
    private String emailError;

    public String getUserError() {
        return userError;
    }

    public void setUserError(String userError) {
        this.userError = userError;
    }

    public String getPasswordError() {
        return passwordError;
    }

    public void setPasswordError(String passwordError) {
        this.passwordError = passwordError;
    }

    public String getEmailError() {
        return emailError;
    }

    public void setEmailError(String emailError) {
        this.emailError = emailError;
    }
}
