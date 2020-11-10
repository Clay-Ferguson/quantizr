import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { ValidatedState } from "../ValidatedState";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Form } from "../widget/Form";
import { TextField2 } from "../widget/TextField2";

// #recaptcha-disabled
// declare var grecaptcha;
// declare var reCaptcha3SiteKey;

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class SignupDlg extends DialogBase {

    userState: ValidatedState<any> = new ValidatedState<any>();
    passwordState: ValidatedState<any> = new ValidatedState<any>();
    emailState: ValidatedState<any> = new ValidatedState<any>();

    constructor(state: AppState) {
        super("Crete Account", "app-modal-content-medium-width", null, state);
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new TextField2("User", false, null, null, false, this.userState),
                new TextField2("Password", true, null, null, false, this.passwordState),
                new TextField2("Email", false, null, null, false, this.emailState),
                new ButtonBar([
                    new Button("Create Account", this.signup, null, "btn-primary"),
                    new Button("Cancel", this.close)
                ])
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

        S.util.ajax<J.SignupRequest, J.SignupResponse>("signup", {
            userName: this.userState.getValue(),
            password: this.passwordState.getValue(),
            email: this.emailState.getValue(),
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

            this.userState.setError(res.userError);
            this.passwordState.setError(res.passwordError);
            this.emailState.setError(res.emailError);
        }
    }
}
