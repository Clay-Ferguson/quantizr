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
import { TextContent } from "../widget/TextContent";
import { TextField } from "../widget/TextField";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class ResetPasswordDlg extends DialogBase {

    userState: ValidatedState<any> = new ValidatedState<any>();
    emailState: ValidatedState<any> = new ValidatedState<any>();

    constructor(user: string, state: AppState) {
        super("Reset Password", "app-modal-content-narrow-width", false, state);
        this.mergeState({ user });
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new TextContent("Enter your user name and email address to recieve a reset link."),
                new TextField("User Name", false, null, null, false, this.userState),
                new TextField("Email Address", false, null, null, false, this.emailState),
                new ButtonBar([
                    new Button("Reset my Password", this.resetPassword, null, "btn-primary"),
                    new Button("Close", this.close)
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
            if (this.userState.getValue().trim().toLowerCase() === "admin") {
                valid = false;
                this.userState.setError("Invalid use name");
            }
            else {
                this.userState.setError(null);
            }
        }

        if (!this.emailState.getValue()) {
            this.emailState.setError("Cannot be empty.");
            valid = false;
        }
        else {
            this.emailState.setError(null);
        }

        return valid;
    }

    resetPassword = (): void => {
        if (!this.validate()) {
            return;
        }

        S.util.ajax<J.ResetPasswordRequest, J.ResetPasswordResponse>("resetPassword", {
            user: this.userState.getValue(),
            email: this.emailState.getValue()
        }, this.resetPasswordResponse);
    }

    resetPasswordResponse = (res: J.ResetPasswordResponse): void => {
        if (S.util.checkSuccess("Reset password", res)) {
            this.close();
            S.util.showMessage("Password reset email was sent. Check your email.", "Note");
        }
    }
}
