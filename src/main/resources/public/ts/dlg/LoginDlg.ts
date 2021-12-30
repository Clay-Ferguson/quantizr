import { AppState } from "../AppState";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { Form } from "../comp/core/Form";
import { TextField } from "../comp/core/TextField";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { ValidatedState } from "../ValidatedState";
import { ConfirmDlg } from "./ConfirmDlg";
import { ResetPasswordDlg } from "./ResetPasswordDlg";

export class LoginDlg extends DialogBase {

    userState: ValidatedState<any> = new ValidatedState<any>();
    pwdState: ValidatedState<any> = new ValidatedState<any>();

    constructor(paramsTest: Object, state: AppState) {
        super("Login", "app-modal-content-narrow-width", false, state);
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new TextField("User", false, this.login, null, false, this.userState),
                new TextField("Password", true, this.login, null, false, this.pwdState),
                new Div("Signup", { className: "clickable marginTop", onClick: this.signup }),
                new Div("Forgot Password", { className: "clickable marginTop", onClick: this.resetPassword })
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

    preLoad = async () => {
        let user = await S.localDB.getVal(C.LOCALDB_LOGIN_USR);
        let pwd = await S.localDB.getVal(C.LOCALDB_LOGIN_PWD);

        this.userState.setValue(user);
        this.pwdState.setValue(pwd);
    }

    signup = (): void => {
        this.close();
        S.nav.signup(this.appState);
    }

    login = async (): Promise<void> => {
        if (!this.validate()) {
            return;
        }
        let usr = this.userState.getValue();

        /* The word admin is not a secret so let's make it easy for the admin to login using only his password */
        if (usr === "a") {
            usr = "admin";
        }
        let pwd = this.pwdState.getValue();

        if (usr && pwd) {
            let res: J.LoginResponse = await S.util.ajax<J.LoginRequest, J.LoginResponse>("login", {
                userName: usr,
                password: pwd,
                tzOffset: new Date().getTimezoneOffset(),
                dst: S.util.daylightSavingsTime
            });

            S.quanta.authToken = res.authToken;
            S.user.loginResponse(res, usr, pwd, true, this.appState);
            this.close();
        }
    }

    resetPassword = async (): Promise<any> => {
        let usr = this.userState.getValue();

        let dlg: ConfirmDlg = new ConfirmDlg("Reset your password ?", "Confirm", null, null, this.appState);
        await dlg.open();
        if (dlg.yes) {
            this.close();
            new ResetPasswordDlg(usr, this.appState).open();
        }
    }

    renderButtons(): CompIntf {
        return new ButtonBar([
            new Button("Login", this.login, null, "btn-primary"),
            new Button("Close", this.close, null, "btn-secondary float-end")
        ], "marginTop");
    }
}
