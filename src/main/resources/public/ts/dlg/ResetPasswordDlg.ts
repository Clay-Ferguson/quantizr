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
import { TextContent } from "../widget/TextContent";
import { TextField } from "../widget/TextField";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class ResetPasswordDlg extends DialogBase {

    constructor(user: string, state: AppState) {
        super("Reset Password", "app-modal-content-narrow-width", false, state);
        this.mergeState({ user });
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new TextContent("Enter your user name and email address and a change-password link will be sent to you"),

                new TextField("User Name", false, null, null, new CompValueHolder<string>(this, "user")),
                new TextField("Email Address", false, null, null, new CompValueHolder<string>(this, "email")),
                new ButtonBar([
                    new Button("Reset my Password", this.resetPassword, null, "btn-primary"),
                    new Button("Close", () => {
                        this.close();
                    })
                ])
            ])
        ];
    }

    renderButtons(): CompIntf {
        return null;
    }

    resetPassword = (): void => {
        let state = this.getState();
        var userName = state.user;
        var emailAddress = state.email;

        /* Note: Admin check is done also on server, so no browser hacking can get around this */
        if (userName && emailAddress && userName.toLowerCase() !== "admin") {
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
