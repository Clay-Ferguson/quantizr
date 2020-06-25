import * as J from "../JavaIntf";
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
import { CompIntf } from "../widget/base/CompIntf";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class LoginDlg extends DialogBase {

    userTextField: TextField;
    passwordTextField: TextField;

    constructor(paramsTest: Object, state: AppState) {
        super("Login", "app-modal-content-narrow-width", false, state);
    }

    renderDlg(): CompIntf[] {
        let children = [
            new Form(null, [
                new FormGroup(null, [
                    this.userTextField = new TextField("User", null, false, this.login),
                    this.passwordTextField = new TextField("Password", null, true, this.login)
                ]),
                new ButtonBar([
                    new Button("Login", this.login, null, "btn-primary"),
                    new Button("Forgot Password", this.resetPassword),
                    new Button("Close", () => {
                        this.close();
                    })
                ])

            ])
        ];
        this.populateFromLocalDb();
        return children;
    }

    populateFromLocalDb = (): void => {
        this.whenElm(async (elm: HTMLElement) => {
            this.userTextField.setValue(await S.localDB.getVal(C.LOCALDB_LOGIN_USR));
            this.passwordTextField.setValue(await S.localDB.getVal(C.LOCALDB_LOGIN_PWD));
        });
    }

    login = (): void => {
        let usr = this.userTextField.getValue();
        let pwd = this.passwordTextField.getValue();
        
        if (usr && pwd) {
            S.util.ajax<J.LoginRequest, J.LoginResponse>("login", {
                userName: usr,
                password: pwd,
                tzOffset: new Date().getTimezoneOffset(),
                dst: S.util.daylightSavingsTime
            }, (res: J.LoginResponse) => {
                S.user.loginResponse(res, usr, pwd, true, this.appState);
                this.close()
            });
        }
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
