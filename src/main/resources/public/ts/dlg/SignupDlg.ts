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
        super("Create Account", "app-modal-content-medium-width", null, state);
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new TextField("User", false, null, null, new CompValueHolder<string>(this, "user")),
                new TextField("Password", true, null, null, new CompValueHolder<string>(this, "password")),
                new TextField("Email", false, null, null, new CompValueHolder<string>(this, "email")),
                new ButtonBar([
                    new Button("Create Account", this.signup, null, "btn-primary"),
                    new Button("Cancel", this.close)
                ])
            ])
        ];
    }

    renderButtons(): CompIntf {
        return null;
    }

    signup = (): void => {
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
        let userName = state.user;
        let password = state.password;
        let email = state.email;

        /* no real validation yet, other than non-empty */
        if (!userName || userName.length === 0 || //
            !password || password.length === 0 || //
            !email || email.length === 0) {
            S.util.showMessage("You cannot leave any fields blank.", "Warning");
            return;
        }

        if (userName.length > 25) {
            S.util.showMessage("Maximum username length allowed is 25", "Warning");
            return;
        }

        if (!S.util.validUsername(userName)) {
            S.util.showMessage("Invalid Username. Only letters numbers dashes and underscores allowed.", "Warning");
            return;
        }

        if (email.length > 25) {
            S.util.showMessage("Maximum email length allowed is 25", "Warning");
            return;
        }

        if (password.length > 25) {
            S.util.showMessage("Maximum password length allowed is 25", "Warning");
            return;
        }

        S.util.ajax<J.SignupRequest, J.SignupResponse>("signup", {
            userName,
            password,
            email,
            reCaptchaToken
        }, this.signupResponse);

        this.close();
    }

    signupResponse = (res: J.SignupResponse): void => {
        if (S.util.checkSuccess("Signup new user", res)) {

            /* close the signup dialog */
            this.close();

            S.util.showMessage(
                "User Information Accepted.<p/><p/>Check your email for account verification.", "Note"
            );
        }
    }
}
