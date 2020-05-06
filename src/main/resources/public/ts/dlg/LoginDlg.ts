import { ConfirmDlg } from "./ConfirmDlg";
import { ResetPasswordDlg } from "./ResetPasswordDlg";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { TextField } from "../widget/TextField";
import { Form } from "../widget/Form";
import { FormGroup } from "../widget/FormGroup";
import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { DialogBase } from "../DialogBase";
import { AppState } from "../AppState";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class LoginDlg extends DialogBase {

    userTextField: TextField;
    passwordTextField: TextField;

    constructor(paramsTest: Object, state: AppState) {
        super("Login", "app-modal-content-narrow-width", false, false, state);
    }

    preRender = () => {
        this.setChildren([
            new Form(null, [
                new FormGroup(null,
                    [
                        this.userTextField = new TextField("User", {
                            onKeyPress: (e: KeyboardEvent) => {
                                if (e.which == 13) { // 13==enter key code
                                    this.login();
                                    return false;
                                }
                            }
                        }),
                        this.passwordTextField = new TextField("Password", {
                            onKeyPress: (e: KeyboardEvent) => {
                                if (e.which == 13) { // 13==enter key code
                                    this.login();
                                    return false;
                                }
                            },
                        }, null, true),
                    ]
                ),
                new ButtonBar(
                    [
                        new Button("Login", this.login, null, "btn-primary"),
                        new Button("Forgot Password", this.resetPassword),
                        new Button("Close", () => {
                            this.close();
                        })
                    ])

            ])
        ]);
        this.populateFromLocalDb();
    }

    populateFromLocalDb = async (): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {
            try {
                this.userTextField.setValue(await S.localDB.getVal(C.LOCALDB_LOGIN_USR));
                this.passwordTextField.setValue(await S.localDB.getVal(C.LOCALDB_LOGIN_PWD));
            }
            finally {
                resolve();
            }
        });
    }

    login = (): void => {
        let usr = this.userTextField.getValue();
        let pwd = this.passwordTextField.getValue();
        S.user.login(this, usr, pwd, this.appState);
        this.close();
    }

    resetPassword = (): any => {
        let usr = this.userTextField.getValue();

        new ConfirmDlg("Reset your password ?",
            "Confirm",
            () => {
                this.close();
                new ResetPasswordDlg({ "user": usr }, this.appState).open();
            }, null, null, null, this.appState
        ).open();
    }
}
