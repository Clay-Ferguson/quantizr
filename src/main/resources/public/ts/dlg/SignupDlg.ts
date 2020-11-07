import { AppState } from "../AppState";
import { CompValueHolder } from "../CompValueHolder";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Form } from "../widget/Form";
import { TextField } from "../widget/TextField";

// #recaptcha-disabled
// declare var grecaptcha;
// declare var reCaptcha3SiteKey;

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class SignupDlg extends DialogBase {

    constructor(state: AppState) {
        super("Crete Account", "app-modal-content-medium-width", null, state);
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new TextField("User", false, null, null, false, new CompValueHolder<string>(this, "user")),
                new TextField("Password", true, null, null, false, new CompValueHolder<string>(this, "password")),
                new TextField("Email", false, null, null, false, new CompValueHolder<string>(this, "email")),
                new ButtonBar([
                    new Button("Create Account", this.signup, null, "btn-primary"),
                    new Button("Cancel", this.close)
                ])
            ])
        ];
    }

    validate = (): boolean => {
        let valid = true;
        let errors: any = {};
        let state = this.getState();

        if (!state.user) {
            errors.userValidationError = "Cannot be empty.";
            valid = false;
        }
        else {
            if (state.user.length > 25) {
                errors.userValidationError = "Maximum username length allowed is 25";
                valid = false;
            }
            else if (!S.util.validUsername(state.user)) {
                errors.userValidationError = "Invalid Username. Only letters numbers dashes and underscores allowed.";
                valid = false;
            }
            else {
                errors.userValidationError = null;
            }
        }

        if (!state.password) {
            errors.passwordValidationError = "Cannot be empty.";
            valid = false;
        }
        else {
            if (state.password.length > 25) {
                errors.passwordValidationError = "Maximum password length allowed is 25";
                valid = false;
            }
            else {
                errors.passwordValidationError = null;
            }
        }

        if (!state.email) {
            errors.emailValidationError = "Cannot be empty.";
            valid = false;
        }
        else {
            if (state.email.length > 50) {
                errors.emailValidationError = "Maximum email length allowed is 50";
                valid = false;
            }
            else {
                errors.emailValidationError = null;
            }
        }

        this.mergeState(errors);
        return valid;
    }

    renderButtons(): CompIntf {
        return null;
    }

    signup = (): void => {
        if (!this.validate()) {
            return;
        }
        // #recaptcha-disabled
        // grecaptcha.ready(() => {
        //     grecaptcha.execute(reCaptcha3SiteKey, { action: 'submit' }).then((token) => {
        //         this.signupNow(token);
        //     });
        // });
        this.signupNow(null);
    }

    signupNow = (reCaptchaToken: string): void => {
        let state = this.getState();

        S.util.ajax<J.SignupRequest, J.SignupResponse>("signup", {
            userName: state.user,
            password: state.password,
            email: state.email,
            reCaptchaToken
        }, this.signupResponse);
    }

    signupResponse = (res: J.SignupResponse): void => {
        if (res.success) {
            /* close the signup dialog */
            this.close();

            S.util.showMessage(
                "User Information Accepted.<p/><p/>Check your email for verification link.", "Note"
            );
        }
        else {
            let errors: any = {};

            // S.util.showMessage("Invalid information for Signup", "Signup");

            errors.userValidationError = res.userError;
            errors.passwordValidationError = res.passwordError;
            errors.emailValidationError = res.emailError;

            this.mergeState(errors);
        }
    }
}
