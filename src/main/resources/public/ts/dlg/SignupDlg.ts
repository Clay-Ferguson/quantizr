import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { HorizontalLayout } from "../comp/core/HorizontalLayout";
import { Img } from "../comp/core/Img";
import { TextField } from "../comp/core/TextField";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { Validator, ValidatorRuleName } from "../Validator";

declare const g_brandingAppName: string;

export class SignupDlg extends DialogBase {

    userState: Validator = new Validator("", [
        { name: ValidatorRuleName.REQUIRED },
        { name: ValidatorRuleName.MAXLEN, payload: 25 },
        { name: ValidatorRuleName.USERNAME }
    ]);

    passwordState: Validator = new Validator("", [{ name: ValidatorRuleName.REQUIRED }]);

    emailState: Validator = new Validator("", [
        { name: ValidatorRuleName.REQUIRED },
        { name: ValidatorRuleName.MAXLEN, payload: 50 }
    ]);

    captchaState: Validator = new Validator("", [{ name: ValidatorRuleName.REQUIRED }]);

    constructor() {
        super("Create Account", "app-modal-content-medium-width");
        this.validatedStates = [this.userState, this.passwordState, this.emailState, this.captchaState];
    }

    renderDlg(): CompIntf[] {
        return [
            new Div(null, null, [
                new TextField({ label: "User Name", val: this.userState }),
                new TextField({ label: "Password", pwd: true, val: this.passwordState }),
                new TextField({ label: "Email", val: this.emailState }),

                new HorizontalLayout([
                    new Img(null, {
                        src: window.location.origin + "/mobile/api/captcha?cacheBuster=" + this.getId(),
                        className: "captchaImage"
                    }),
                    new Div(null, null, [
                        new TextField({ label: "Enter Numbers Displayed", val: this.captchaState })
                    ])
                ]),
                new ButtonBar([
                    new Button("Create Account", this.signup, null, "btn-primary"),
                    new Button("Cancel", this.close)
                ], "marginTop")
            ])
        ];
    }

    signup = () => {
        if (!this.validate()) {
            return;
        }
        this.signupNow(null);
    }

    signupNow = async (reCaptchaToken: string) => {
        const res = await S.util.ajax<J.SignupRequest, J.SignupResponse>("signup", {
            userName: this.userState.getValue(),
            password: this.passwordState.getValue(),
            email: this.emailState.getValue(),
            captcha: this.captchaState.getValue()
        });
        this.signupResponse(res);
    }

    signupResponse = async (res: J.SignupResponse): Promise<void> => {
        if (res.success) {
            /* close the signup dialog */
            this.close();

            await S.util.showMessage(
                "Check your email for verification link.", "Welcome to " + g_brandingAppName + "!"
            );

            window.location.href = window.location.origin;
        }
        else {
            // S.util.showMessage("Invalid information for Signup", "Signup");

            this.userState.setError(res.userError);
            this.passwordState.setError(res.passwordError);
            this.emailState.setError(res.emailError);
            this.captchaState.setError(res.captchaError);
        }
        return null;
    }
}
