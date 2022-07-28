import { getAppState } from "../AppRedux";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { Span } from "../comp/core/Span";
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

    constructor() {
        super("Login", "app-modal-content-narrow-width");
    }

    renderDlg(): CompIntf[] {
        return [
            new Div(null, null, [
                new TextField({ label: "User", enter: this.login, val: this.userState }),
                new TextField({ label: "Password", pwd: true, enter: this.login, val: this.pwdState }),
                new Div(null, { className: "marginTop marginBottom" }, [
                    new Span("Signup", { className: "clickable", onClick: this.signup }),
                    new Span("Reset Password", { className: "clickable float-end", onClick: this.resetPassword })
                ])
            ]),
            new ButtonBar([
                new Button("Login", this.login, null, "btn-primary"),
                new Button("Close", this.close, null, "btn-secondary float-end")
            ], "marginTop")
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

    signup = () => {
        this.close();
        S.user.userSignup();
    }

    login = async () => {
        let usr = this.userState.getValue();

        /* The word admin is not a secret so let's make it easy for the admin to login using only his password */
        if (usr === "a") {
            usr = "admin";
        }

        // if the password field is empty, or CTRL key is down, and a username is provided, then get the password from the browser
        // and ignore the password field.
        if ((!this.pwdState.getValue() || S.util.ctrlKeyCheck()) && usr) {
            // this is kind of ugly but we need to set localDb userName for keys to generate properly
            S.localDB.userName = usr;

            // lookup the password based on known user
            let pwd = await S.localDB.getVal(C.LOCALDB_LOGIN_PWD, usr);
            if (pwd) {
                // put password in the password field
                this.pwdState.setValue(pwd);
                console.log("Got password from LOCAL storage.");
            }
        }

        if (!this.validate()) {
            return;
        }

        let pwd = this.pwdState.getValue();

        if (usr && pwd) {
            let res = await S.util.ajax<J.LoginRequest, J.LoginResponse>("login", {
                userName: usr,
                password: pwd,
                tzOffset: new Date().getTimezoneOffset(),
                dst: S.util.daylightSavingsTime
            });

            if (res.success) {
                S.quanta.authToken = res.authToken;
                S.user.loginResponse(res, usr, pwd, true, getAppState());
                this.close();
            }
        }
    }

    resetPassword = async (): Promise<any> => {
        let usr = this.userState.getValue();
        let dlg = new ConfirmDlg("Reset your password ?", "Confirm", null, null);
        await dlg.open();
        if (dlg.yes) {
            this.close();
            new ResetPasswordDlg(usr).open();
        }
    }
}
