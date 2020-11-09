import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { ValidatedState } from "../ValidatedState";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Form } from "../widget/Form";
import { FormGroup } from "../widget/FormGroup";
import { TextField2 } from "../widget/TextField2";
import { ConfirmDlg } from "./ConfirmDlg";
import { ResetPasswordDlg } from "./ResetPasswordDlg";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class LoginDlg extends DialogBase {

    userState: ValidatedState<any> = new ValidatedState<any>();
    pwdState: ValidatedState<any> = new ValidatedState<any>();

    constructor(paramsTest: Object, state: AppState) {
        super("Login", "app-modal-content-narrow-width", false, state);
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new FormGroup(null, [
                    new TextField2("User", false, this.login, null, false, this.userState),
                    new TextField2("Password", true, this.login, null, false, this.pwdState)
                ]),
                new ButtonBar([
                    new Button("Login", this.login, null, "btn-primary"),
                    new Button("Forgot Password", this.resetPassword),
                    new Button("Close", this.close)
                ])
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
            this.userState.setError(null);
        }

        if (!this.pwdState.getValue()) {
            this.pwdState.setError("Cannot be empty.");
            valid = false;
        }
        else {
            this.pwdState.setError(null);
        }

        return valid;
    }

    renderButtons(): CompIntf {
        return null;
    }

    preLoad = async () => {
        let user = await S.localDB.getVal(C.LOCALDB_LOGIN_USR);
        let pwd = await S.localDB.getVal(C.LOCALDB_LOGIN_PWD);

        this.userState.setValue(user);
        this.pwdState.setValue(pwd);
    }

    login = (): void => {
        if (!this.validate()) {
            return;
        }

        let usr = this.userState.getValue();
        let pwd = this.pwdState.getValue();

        if (usr && pwd) {
            S.util.ajax<J.LoginRequest, J.LoginResponse>("login", {
                userName: usr,
                password: pwd,
                tzOffset: new Date().getTimezoneOffset(),
                dst: S.util.daylightSavingsTime
            }, (res: J.LoginResponse) => {
                S.user.loginResponse(res, usr, pwd, true, this.appState);
                this.close();
            });
        }
    }

    resetPassword = (): any => {
        let usr = this.userState.getValue();

        new ConfirmDlg("Reset your password ?",
            "Confirm",
            () => {
                this.close();
                new ResetPasswordDlg(usr, this.appState).open();
            }, null, null, null, this.appState
        ).open();
    }
}
