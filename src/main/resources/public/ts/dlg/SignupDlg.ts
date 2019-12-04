import { DialogBase } from "../DialogBase";
import * as I from "../Interfaces";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { TextField } from "../widget/TextField";
import { PasswordTextField } from "../widget/PasswordTextField";
import { Captcha } from "../widget/Captcha";
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
    captchaTextField: TextField;
    captchaImage: Captcha;

    constructor() {
        super("Create SubNode Account", "app-modal-content-login-dlg");
        
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
                this.captchaTextField = new TextField({
                    "placeholder": "",
                    "label": "Captcha"
                }),
                this.captchaImage = new Captcha(),
                new ButtonBar([
                    new Button("Try Another Image", this.tryAnotherCaptcha),
                ]),
                new ButtonBar([
                    new Button("Create Account", this.signup),
                    new Button("Cancel", this.close)
                ])
            ])
        ]);
    }

    signup = (): void => {
        let userName = this.userTextField.getValue();
        let password = this.passwordTextField.getValue();
        let email = this.emailTextField.getValue();
        let captcha = this.captchaTextField.getValue();

        /* no real validation yet, other than non-empty */
        if (!userName || userName.length == 0 || //
            !password || password.length == 0 || //
            !email || email.length == 0 || //
            !captcha || captcha.length == 0) {
            S.util.showMessage("You cannot leave any fields blank.");
            return;
        }

        S.util.ajax<I.SignupRequest, I.SignupResponse>("signup", {
            "userName": userName,
            "password": password,
            "email": email,
            "captcha": captcha
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

    tryAnotherCaptcha = (): void => {
        let cacheBuster = S.util.currentTimeMillis();
        let src = S.util.getRpcPath() + "captcha?t=" + cacheBuster;
        this.captchaImage.setSrc(src);
    }

    pageInitSignupPg = (): void => {
        this.tryAnotherCaptcha();
    }

    init = (): void => {
        this.pageInitSignupPg();
        this.userTextField.focus();
    }
}
