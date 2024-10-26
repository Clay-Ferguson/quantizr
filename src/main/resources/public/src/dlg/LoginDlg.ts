import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Clearfix } from "../comp/core/Clearfix";
import { Div } from "../comp/core/Div";
import { Span } from "../comp/core/Span";
import { TextField } from "../comp/core/TextField";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { Validator, ValidatorRuleName } from "../Validator";
import { ConfirmDlg } from "./ConfirmDlg";
import { ResetPasswordDlg } from "./ResetPasswordDlg";

export class LoginDlg extends DialogBase {
    userState: Validator = new Validator("", [{ name: ValidatorRuleName.REQUIRED }]);
    pwdState: Validator = new Validator("", [{ name: ValidatorRuleName.REQUIRED }]);

    constructor() {
        super("Login", "appModalContNarrowWidth");
        this.validatedStates = [this.userState, this.pwdState];
    }

    renderDlg(): Comp[] {
        return [
            new Div(null, { c: "LoginContainerDiv" }, [
                new TextField({ label: "User", enter: this._login, val: this.userState }),
                new TextField({ label: "Password", inputType: "password", enter: this._login, val: this.pwdState }),
                new Div(null, { className: "marginTop marginBottom" }, [
                    new Span("Reset Password", { className: "cursor-pointer tw-float-right", onClick: this._resetPassword }),
                    new Clearfix()
                ])
            ]),
            new ButtonBar([
                new Button("Login", this._login, null, "-primary ui-login"),
                new Button("Close", () => {
                    this.close();
                    S.util._loadAnonPageHome();
                }, null, "tw-float-right")
            ], "marginTop")
        ];
    }

    override async preLoad() {
        const user = await S.localDB.getVal(C.LOCALDB_LOGIN_USR);
        const pwd = await S.localDB.getVal(C.LOCALDB_LOGIN_PWD);

        this.userState.setValue(user);
        this.pwdState.setValue(pwd);
    }

    _login = async () => {
        let usr = this.userState.getValue();

        /* The word admin is not a secret so let's make it easy for the admin to login using only
        his password */
        if (usr === "a") {
            usr = J.PrincipalName.ADMIN;
        }

        await S.localDB.setUser(usr);

        // if the password field is empty, or CTRL key is down, and a username is provided, then get
        // the password from the browser and ignore the password field.
        if ((!this.pwdState.getValue() || S.util.ctrlKeyCheck()) && usr) {
            // this is kind of ugly but we need to set localDb userName for keys to generate properly

            // lookup the password based on known user
            const pwd = await S.localDB.getVal(C.LOCALDB_LOGIN_PWD);
            if (pwd) {
                // put password in the password field
                this.pwdState.setValue(pwd);
                console.log("Got password from LOCAL storage.");
            }
        }

        if (!this.validate()) {
            return;
        }

        const pwd = this.pwdState.getValue();
        if (usr && pwd) {
            await S.quanta.initKeys(usr);

            const res = await S.rpcUtil.rpc<J.LoginRequest, J.LoginResponse>("login", {
                userName: usr,
                password: pwd,
                tzOffset: new Date().getTimezoneOffset(),
                dst: S.util._daylightSavingsTime,
                sigKey: S.crypto.sigKey,
                asymEncKey: S.crypto.asymEncKey
            }, false, true);
            S.quanta.authToken = res.authToken;

            if (res?.code == C.RESPONSE_CODE_OK) {
                await S.user.loginResponse(res, usr, pwd, true);
                this.close();
                await S.quanta.initialRender();
            }
        }
    }

    _resetPassword = async (): Promise<any> => {
        const usr = this.userState.getValue();
        const dlg = new ConfirmDlg("Reset your password ?", "Confirm");
        await dlg.open();
        if (dlg.yes) {
            this.close();
            new ResetPasswordDlg(usr).open();
        }
    }
}
