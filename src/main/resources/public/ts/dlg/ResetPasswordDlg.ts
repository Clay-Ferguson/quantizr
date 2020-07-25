import * as J from "../JavaIntf";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { TextField } from "../widget/TextField";
import { TextContent} from "../widget/TextContent";
import { PubSub } from "../PubSub";
import { Constants as C} from "../Constants";
import { Singletons } from "../Singletons";
import { Form } from "../widget/Form";
import { DialogBase } from "../DialogBase";
import { AppState } from "../AppState";
import { CompIntf } from "../widget/base/CompIntf";
import { CompValueHolder } from "../CompValueHolder";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class ResetPasswordDlg extends DialogBase {

    constructor(user: string, state: AppState) {
        super("Reset Password", "app-modal-content-narrow-width", false, state);
        this.mergeState({user});
    }
    
    renderDlg(): CompIntf[] {
        let children = [
            new Form(null, [
                new TextContent("Enter your user name and email address and a change-password link will be sent to you"),
    
                new TextField("User Name", false, null, new CompValueHolder<string>(this, "user")),
                new TextField("Email Address", false, null, new CompValueHolder<string>(this, "email")),
                new ButtonBar([
                    new Button("Reset my Password", this.resetPassword, null, "btn-primary"),
                    new Button("Close", () => {
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

    resetPassword = (): void => {
        let state = this.getState();
        var userName = state.user;
        var emailAddress = state.email;

        /* Note: Admin check is done also on server, so no browser hacking can get around this */
        if (userName && emailAddress && userName.toLowerCase() != "admin") {
            S.util.ajax<J.ResetPasswordRequest, J.ResetPasswordResponse>("resetPassword", {
                user: userName,
                email: emailAddress
            }, this.resetPasswordResponse);
        } else {
            S.util.showMessage("Oops. Try that again.", "Warning");
        }
        this.close();
    }

    resetPasswordResponse = (res: J.ResetPasswordResponse): void => {
        if (S.util.checkSuccess("Reset password", res)) {
            S.util.showMessage("Password reset email was sent. Check your email.", "Warning");
        }
    }
}
