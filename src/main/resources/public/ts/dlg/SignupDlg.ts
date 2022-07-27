import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { Form } from "../comp/core/Form";
import { HorizontalLayout } from "../comp/core/HorizontalLayout";
import { Img } from "../comp/core/Img";
import { TextField } from "../comp/core/TextField";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { ValidatedState } from "../ValidatedState";

declare var g_brandingAppName;

export class SignupDlg extends DialogBase {

    userState: ValidatedState<any> = new ValidatedState<any>();
    passwordState: ValidatedState<any> = new ValidatedState<any>();
    emailState: ValidatedState<any> = new ValidatedState<any>();
    captchaState: ValidatedState<any> = new ValidatedState<any>();

    constructor() {
        super("Create Account", "app-modal-content-medium-width");
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new TextField({ label: "User Name", val: this.userState }),
                new TextField({ label: "Password", pwd: true, val: this.passwordState }),
                new TextField({ label: "Email", val: this.emailState }),

                new HorizontalLayout([
                    new Img(null, {
                        src: window.location.origin + "/mobile/api/captcha?cacheBuster=" + this.getId(),
                        className: "captchaImage"
                    }),
                    new Div(null, null, [
                        new TextField({ label: "Captcha", val: this.captchaState })
                    ])
                ]),
                new ButtonBar([
                    new Button("Create Account", this.signup, null, "btn-primary"),
                    new Button("Cancel", this.close)
                ], "marginTop")
            ])
        ];
    }

    validate = (): boolean => {
        let valid = true;

        if (!this.userState.getValue()) {
            this.userState.setError("Cannot be empty.");
            valid = false;
        }
        else {
            if (this.userState.getValue().length > 25) {
                this.userState.setError("Maximum username length allowed is 25");
                valid = false;
            }
            else if (!S.util.validUsername(this.userState.getValue())) {
                this.userState.setError("Invalid Username. Only letters numbers dashes and underscores allowed.");
                valid = false;
            }
            else {
                this.userState.setError(null);
            }
        }

        if (!this.passwordState.getValue()) {
            this.passwordState.setError("Cannot be empty.");
            valid = false;
        }
        else {
            if (this.passwordState.getValue().length > 25) {
                this.passwordState.setError("Maximum password length allowed is 25");
                valid = false;
            }
            else {
                this.passwordState.setError(null);
            }
        }

        if (!this.emailState.getValue()) {
            this.emailState.setError("Cannot be empty.");
            valid = false;
        }
        else {
            if (this.emailState.getValue().length > 50) {
                this.emailState.setError("Maximum email length allowed is 50");
                valid = false;
            }
            else {
                this.emailState.setError(null);
            }
        }

        if (!this.captchaState.getValue()) {
            this.captchaState.setError("Cannot be empty.");
            valid = false;
        }
        else {
            this.captchaState.setError(null);
        }

        return valid;
    }

    signup = () => {
        if (!this.validate()) {
            return;
        }
        this.signupNow(null);
    }

    signupNow = async (reCaptchaToken: string) => {
        let res = await S.util.ajax<J.SignupRequest, J.SignupResponse>("signup", {
            userName: this.userState.getValue(),
            password: this.passwordState.getValue(),
            email: this.emailState.getValue(),
            captcha: this.captchaState.getValue()
        });
        this.signupResponse(res);
    }

    signupResponse = async (res: J.SignupResponse) => {
        if (res.success) {
            /* close the signup dialog */
            this.close();

            await S.util.showMessage(
                "Check your email for verification link.", "Welcome to " + g_brandingAppName + "!"
            );

            window.location.href = window.location.origin;
        }
        else {
            let errors: any = {};
            // S.util.showMessage("Invalid information for Signup", "Signup");

            this.userState.setError(res.userError);
            this.passwordState.setError(res.passwordError);
            this.emailState.setError(res.emailError);
            this.captchaState.setError(res.captchaError);
        }
        return null;
    }
}
