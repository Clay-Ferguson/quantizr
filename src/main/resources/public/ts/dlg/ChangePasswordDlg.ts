import { PubSub } from "../PubSub";
import { DialogBase } from "../DialogBase";
import { MessageDlg } from "./MessageDlg";
import * as J from "../JavaIntf";
import { TextField } from "../widget/TextField";
import { TextContent } from "../widget/TextContent";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { Form } from "../widget/Form";
import { AppState } from "../AppState";
import { CompIntf } from "../widget/base/CompIntf";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class ChangePasswordDlg extends DialogBase {

    passwordField: TextField;
    pwd: string;
    private passCode: string;

    constructor(args: Object, state: AppState) {
        super((<any>args).passCode ? "Password Reset" : "Change Password", "app-modal-content-narrow-width", false, state);
        this.passCode = (<any>args).passCode;
        this.whenElm((elm: HTMLSelectElement) => {
            this.passwordField.focus();
        });
    }

    renderDlg(): CompIntf[] {
        let children = [
            new Form(null, [
                new TextContent("Enter your new password below..."),
                this.passwordField = new TextField("New Password", null, true),
                new ButtonBar([
                    new Button("Change Password", () => {
                        this.changePassword();
                        this.close();
                    }, null, "btn-primary"),
                    new Button("Close", () =>{
                        this.close();
                    })
                ])
            ])
        ];
        return children;
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
        this.pwd = this.passwordField.getValue();

        if (this.pwd && this.pwd.length >= 4) {
            S.util.ajax<J.ChangePasswordRequest, J.ChangePasswordResponse>("changePassword", {
                newPassword: this.pwd,
                passCode: this.passCode
            }, this.changePasswordResponse);
        } else {
            S.util.showMessage("Invalid password(s).", "Warning");
        }
    }

    changePasswordResponse = (res: J.ChangePasswordResponse) => {
        if (S.util.checkSuccess("Change password", res)) {
            let msg = "Password changed successfully.";

            if (this.passCode) {
                msg += `<p>You can now login as <b>${res.user}</b> with your new password.`;
            }

            let dlg = new MessageDlg(msg, "Password Change",
                () => {
                    if (this.passCode) {
                        window.location.href = window.location.origin;
                    }
                }, null, false, 0, this.appState
            );
            dlg.open();
        }
    }
}
