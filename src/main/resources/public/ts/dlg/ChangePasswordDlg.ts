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
import { MessageDlg } from "./MessageDlg";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class ChangePasswordDlg extends DialogBase {

    passwordField: TextField;
    pwdState: ValidatedState<any> = new ValidatedState<any>();

    constructor(private passCode: string, state: AppState) {
        super(passCode ? "Password Reset" : "Change Password", "app-modal-content-narrow-width", false, state);
        this.whenElm((elm: HTMLSelectElement) => {
            this.passwordField.focus();
        });
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new TextContent("Enter your new password below..."),
                this.passwordField = new TextField("New Password", true, null, null, false, this.pwdState),
                new ButtonBar([
                    new Button("Change Password", this.changePassword, null, "btn-primary"),
                    new Button("Close", this.close)
                ])
            ])
        ];
    }

    validate = (): boolean => {
        let valid = true;

        if (!this.pwdState.getValue()) {
            this.pwdState.setError("Cannot be empty.");
            valid = false;
        }
        else {
            this.pwdState.setError(null);
        }

        return valid;
    }

    renderButtons(): CompIntf {
        return null;
    }

    /*
     * If the user is doing a "Reset Password" we will have a non-null passCode here, and we simply send this to the server
     * where it will validate the passCode, and if it's valid use it to perform the correct password change on the correct
     * user.
     */
    changePassword = (): void => {
        if (!this.validate()) {
            return;
        }
        let pwd = this.pwdState.getValue();

        if (pwd && pwd.length >= 4) {
            S.util.ajax<J.ChangePasswordRequest, J.ChangePasswordResponse>("changePassword", {
                newPassword: pwd,
                passCode: this.passCode
            }, this.changePasswordResponse);
        } else {
            S.util.showMessage("Invalid password(s).", "Warning");
        }
    }

    changePasswordResponse = (res: J.ChangePasswordResponse) => {
        if (S.util.checkSuccess("Change password", res)) {
            this.close();
            let msg = "Password changed successfully.";

            if (this.passCode) {
                msg += `<p>You can now login as <b>${res.user}</b> with your new password.`;
            }

            let dlg = new MessageDlg(msg, "Password Change",
                () => {
                    if (this.passCode) {
                        window.location.href = window.location.origin + "/app";
                    }
                }, null, false, 0, this.appState
            );
            dlg.open();
        }
    }
}
