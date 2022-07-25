import { AppState } from "../AppState";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Form } from "../comp/core/Form";
import { TextContent } from "../comp/core/TextContent";
import { TextField } from "../comp/core/TextField";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { ValidatedState } from "../ValidatedState";

interface LS { // Local State
    user: string;
}

export class ResetPasswordDlg extends DialogBase {

    userState: ValidatedState<any> = new ValidatedState<any>();
    emailState: ValidatedState<any> = new ValidatedState<any>();

    constructor(user: string, state: AppState) {
        super("Reset Password", "app-modal-content-narrow-width", false, state);
        this.mergeState<LS>({ user });
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new TextContent("Enter your user name and email address to recieve a reset link."),
                new TextField({ label: "User Name", val: this.userState }),
                new TextField({ label: "Email Address", val: this.emailState }),
                new ButtonBar([
                    new Button("Reset Password", this.resetPassword, null, "btn-primary"),
                    new Button("Close", this.close, null, "btn-secondary float-end")
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

    resetPassword = async () => {
        if (!this.validate()) {
            return;
        }

        let res = await S.util.ajax<J.ResetPasswordRequest, J.ResetPasswordResponse>("resetPassword", {
            user: this.userState.getValue(),
            email: this.emailState.getValue()
        });
        this.resetPasswordResponse(res);
    }

    resetPasswordResponse = (res: J.ResetPasswordResponse) => {
        if (S.util.checkSuccess("Reset password", res)) {
            this.close();
            S.util.showMessage("Password reset email was sent. Check your email.", "Note");
        }
    }
}
