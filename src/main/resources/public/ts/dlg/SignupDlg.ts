import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { TextField } from "../widget/TextField";
import { PubSub } from "../PubSub";
import { Constants as C} from "../Constants";
import { Singletons } from "../Singletons";
import { Form } from "../widget/Form";
import { TextContent } from "../widget/TextContent";
import { AppState } from "../AppState";
import { CompIntf } from "../widget/base/CompIntf";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class SignupDlg extends DialogBase {

    userTextField: TextField;
    passwordTextField: TextField;
    emailTextField: TextField;

    constructor(state: AppState) {
        super("Create Account", "app-modal-content-medium-width", null, state);
        this.whenElm((elm: HTMLSelectElement) => {
            this.userTextField.focus();
        });
    }
    
    renderDlg(): CompIntf[] {
        let children = [
            new Form(null, [
                this.userTextField = new TextField("User"),
                this.passwordTextField = new TextField("Password", null, true),
                this.emailTextField = new TextField("Email"),
                new ButtonBar([
                    new Button("Create Account", this.signup, null, "btn-primary"),
                    new Button("Cancel", this.close)
                ])
            ])
        ];
        
        this.pageInitSignupPg();
        return children;
    }

    signup = (): void => {
        let userName = this.userTextField.getValue();
        let password = this.passwordTextField.getValue();
        let email = this.emailTextField.getValue();

        /* no real validation yet, other than non-empty */
        if (!userName || userName.length == 0 || //
            !password || password.length == 0 || //
            !email || email.length == 0) {
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
            email
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

    pageInitSignupPg = (): void => {
    }
}
