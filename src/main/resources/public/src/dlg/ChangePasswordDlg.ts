import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { TextContent } from "../comp/core/TextContent";
import { TextField } from "../comp/core/TextField";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { ValHolder, ValidatorRuleName } from "../ValHolder";
import { MessageDlg } from "./MessageDlg";

export class ChangePasswordDlg extends DialogBase {

    passwordField: TextField;
    pwdState: ValHolder = new ValHolder("", [
        { name: ValidatorRuleName.REQUIRED },
        { name: ValidatorRuleName.MINLEN, payload: 4 }
    ]);

    constructor(private passCode: string) {
        super(passCode ? "Password Reset" : "Save Password", "appModalContNarrowWidth");
        this.onMount(() => this.passwordField?.focus());
        this.validatedStates = [this.pwdState];
    }

    renderDlg(): Comp[] {
        return [
            new Div(null, null, [
                new TextContent("Enter new password below..."),
                this.passwordField = new TextField({
                    label: "New Password",
                    inputType: "password",
                    val: this.pwdState
                }),
                new ButtonBar([
                    new Button("Change Password", this.changePassword, null, "-primary"),
                    new Button("Close", this._close, null, "-secondary float-right")
                ], "mt-3")
            ])
        ];
    }

    /*
     * If the user is doing a "Reset Password" we will have a non-null passCode here, and we simply
     * send this to the server where it will validate the passCode, and if it's valid use it to
     * perform the correct password change on the correct user.
     */
    changePassword = async () => {
        if (!this.validate()) {
            return;
        }
        const pwd = this.pwdState.getValue();
        const res = await S.rpcUtil.rpc<J.ChangePasswordRequest, J.ChangePasswordResponse>("changePassword", {
            newPassword: pwd,
            passCode: this.passCode
        });
        this.changePasswordResponse(res);
    }

    changePasswordResponse = (res: J.ChangePasswordResponse) => {
        if (S.util.checkSuccess("Change password", res)) {
            this.close();
            let msg = "Password changed successfully.";

            if (this.passCode) {
                msg += `<p>You can now login as <b>${res.user}</b> with your new password.`;
            }

            new MessageDlg(msg, "Password Change",
                () => {
                    if (this.passCode) {
                        window.location.href = window.location.origin;
                    }
                }, null, false, 0, null
            ).open();
        }
    }
}
