import * as I from "../Interfaces";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { TextField } from "../widget/TextField";
import { TextContent} from "../widget/TextContent";
import { UtilIntf as Util } from "../intf/UtilIntf";
import { PubSub } from "../PubSub";
import { Constants } from "../Constants";
import { Singletons } from "../Singletons";
import { Form } from "../widget/Form";
import { DialogBase } from "../DialogBase";

let util: Util;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    util = ctx.util;
});

export class ResetPasswordDlg extends DialogBase {
    userTextField: TextField;
    emailTextField: TextField;
    private user: string;

    constructor(args: Object) {
        super("Reset Password");
        this.user = (<any>args).user;
        
        this.setChildren([
            new Form(null, [
                new TextContent("Enter your user name and email address and a change-password link will be sent to you"),
                this.userTextField = new TextField({
                    "placeholder": "",
                    "label": "User Name"
                }),
                this.emailTextField = new TextField({
                    "placeholder": "",
                    "label": "Email Address"
                }),
                new ButtonBar([
                    new Button("Reset my Password", this.resetPassword),
                    new Button("Close", () => {
                        this.close();
                    })
                ])
            ])
        ]);
    }

    resetPassword = (): void => {
        var userName = this.userTextField.getValue();
        var emailAddress = this.emailTextField.getValue();

        /* Note: Admin check is done also on server, so no browser hacking can get around this */
        if (userName && emailAddress && userName.toLowerCase() != "admin") {
            util.ajax<I.ResetPasswordRequest, I.ResetPasswordResponse>("resetPassword", {
                "user": userName,
                "email": emailAddress
            }, this.resetPasswordResponse);
        } else {
            util.showMessage("Oops. Try that again.");
        }
        this.close();
    }

    resetPasswordResponse = (res: I.ResetPasswordResponse): void => {
        if (util.checkSuccess("Reset password", res)) {
            util.showMessage("Password reset email was sent. Check your email.");
        }
    }

    init = (): void => {
        if (this.user) {
            this.userTextField.setValue(this.user);
        }
    }
}
