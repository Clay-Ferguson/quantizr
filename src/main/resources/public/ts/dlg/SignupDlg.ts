import { DialogBase } from "../DialogBase";
import * as I from "../Interfaces";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { TextField } from "../widget/TextField";
import { PasswordTextField } from "../widget/PasswordTextField";
import { PubSub } from "../PubSub";
import { Constants } from "../Constants";
import { Singletons } from "../Singletons";
import { Form } from "../widget/Form";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class SignupDlg extends DialogBase {

    userTextField: TextField;
    passwordTextField: PasswordTextField;
    emailTextField: TextField;

    constructor() {
        super("Create Account", "app-modal-content-medium-width");
        
        this.setChildren([
            new Form(null, [
                this.userTextField = new TextField({
                    "placeholder": "",
                    "label": "User"
                }),
                this.passwordTextField = new PasswordTextField({
                    "placeholder": "",
                    "label": "Password"
                }),
                this.emailTextField = new TextField({
                    "placeholder": "",
                    "label": "Email"
                }),
                new ButtonBar([
                    new Button("Create Account", this.signup, null, "primary"),
                    new Button("Cancel", this.close)
                ])
            ])
        ]);
    }

    signup = (): void => {
        let userName = this.userTextField.getValue();
        let password = this.passwordTextField.getValue();
        let email = this.emailTextField.getValue();

        /* no real validation yet, other than non-empty */
        if (!userName || userName.length == 0 || //
            !password || password.length == 0 || //
            !email || email.length == 0) {
            S.util.showMessage("You cannot leave any fields blank.");
            return;
        }

        if (userName.length > 25) {
            S.util.showMessage("Maximum username length allowed is 25");
            return;
        }

        if (!S.util.validUsername(userName)) {
            S.util.showMessage("Invalid Username. Only letters numbers dashes and underscores allowed.");
            return;
        }

        if (email.length > 25) {
            S.util.showMessage("Maximum email length allowed is 25");
            return;
        }

        if (password.length > 25) {
            S.util.showMessage("Maximum password length allowed is 25");
            return;
        }

        S.util.ajax<I.SignupRequest, I.SignupResponse>("signup", {
            "userName": userName,
            "password": password,
            "email": email
        }, this.signupResponse);

        this.close();
    }

    signupResponse = (res: I.SignupResponse): void => {
        if (S.util.checkSuccess("Signup new user", res)) {

            /* close the signup dialog */
            this.close();

            S.util.showMessage(
                "User Information Accepted.<p/>Check your email for signup confirmation."
            );
        }
    }

    pageInitSignupPg = (): void => {
    }

    init = (): void => {
        this.pageInitSignupPg();
        this.userTextField.focus();
    }
}
