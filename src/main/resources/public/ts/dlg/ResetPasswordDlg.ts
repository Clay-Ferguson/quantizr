import * as J from "../JavaIntf";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { TextField } from "../widget/TextField";
import { TextContent} from "../widget/TextContent";
import { UtilIntf as Util } from "../intf/UtilIntf";
import { PubSub } from "../PubSub";
import { Constants as C} from "../Constants";
import { Singletons } from "../Singletons";
import { Form } from "../widget/Form";
import { DialogBase } from "../DialogBase";
import { AppState } from "../AppState";
import { CompIntf } from "../widget/base/CompIntf";

let util: Util;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    util = ctx.util;
});

export class ResetPasswordDlg extends DialogBase {
    userTextField: TextField;
    emailTextField: TextField;
    private user: string;

    constructor(args: Object, state: AppState) {
        super("Reset Password", "app-modal-content-narrow-width", false, state);
        this.user = (<any>args).user;
    }
    
    renderDlg(): CompIntf[] {
        let children = [
            new Form(null, [
                new TextContent("Enter your user name and email address and a change-password link will be sent to you"),
                this.userTextField = new TextField("User Name"),
                this.emailTextField = new TextField("Email Address"),
                new ButtonBar([
                    new Button("Reset my Password", this.resetPassword, null, "btn-primary"),
                    new Button("Close", () => {
                        this.close();
                    })
                ])
            ])
        ];
        if (this.user) {
            this.userTextField.setValue(this.user);
        }
        return children;
    }

    resetPassword = (): void => {
        var userName = this.userTextField.getValue();
        var emailAddress = this.emailTextField.getValue();

        /* Note: Admin check is done also on server, so no browser hacking can get around this */
        if (userName && emailAddress && userName.toLowerCase() != "admin") {
            util.ajax<J.ResetPasswordRequest, J.ResetPasswordResponse>("resetPassword", {
                user: userName,
                email: emailAddress
            }, this.resetPasswordResponse);
        } else {
            util.showMessage("Oops. Try that again.", "Warning");
        }
        this.close();
    }

    resetPasswordResponse = (res: J.ResetPasswordResponse): void => {
        if (util.checkSuccess("Reset password", res)) {
            util.showMessage("Password reset email was sent. Check your email.", "Warning");
        }
    }
}
