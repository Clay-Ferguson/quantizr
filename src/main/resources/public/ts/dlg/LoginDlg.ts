import { ConfirmDlg } from "./ConfirmDlg";
import { ResetPasswordDlg } from "./ResetPasswordDlg";
import { PasswordTextField } from "../widget/PasswordTextField";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { TextField } from "../widget/TextField";
import { Form } from "../widget/Form";
import { Div } from "../widget/Div";
import { Constants } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { DialogBase } from "../DialogBase";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class LoginDlg extends DialogBase {

    userTextField: TextField;
    passwordTextField: PasswordTextField;

    constructor(paramsTest: Object) {
        super("Login", "app-modal-content-narrow-width");

        this.setChildren([
            new Form(null, [
                new Div(null, {
                    className: "form-group"
                },
                    [
                        this.userTextField = new TextField({
                            placeholder: "",
                            label: "User",
                            onKeyPress: (e) => {
                                if (e.which == 13) { // 13==enter key code
                                    this.login();
                                    return false;
                                }
                            }
                        }),
                        this.passwordTextField = new PasswordTextField({
                            "placeholder": "",
                            "label": "Password",
                            onKeyPress: (e) => {
                                if (e.which == 13) { // 13==enter key code
                                    this.login();
                                    return false;
                                }
                            }
                        }),
                    ]
                ),
                new ButtonBar(
                    [
                        new Button("Login", this.login, null, "primary"),
                        new Button("Forgot Password", this.resetPassword),
                        new Button("Close", () => {
                            this.close();
                        })
                    ])

            ])
        ]);
    }

    init = (): void => {
        this.populateFromLocalDb();
    }

    populateFromLocalDb = async (): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {
            try {
                this.userTextField.setValue(await S.localDB.getVal(Constants.LOCALDB_LOGIN_USR));
                this.passwordTextField.setValue(await S.localDB.getVal(Constants.LOCALDB_LOGIN_PWD));
            }
            finally {
                resolve();
            }
        });
    }

    login = (): void => {
        let usr = this.userTextField.getValue();
        let pwd = this.passwordTextField.getValue();
        S.user.login(this, usr, pwd);
        this.close();
    }

    resetPassword = (): any => {
        let usr = this.userTextField.getValue();

        new ConfirmDlg("Reset your password ?",

            "Confirm",
            () => {
                this.close();
                new ResetPasswordDlg({ "user": usr }).open();
            }
        ).open();
    }
}
