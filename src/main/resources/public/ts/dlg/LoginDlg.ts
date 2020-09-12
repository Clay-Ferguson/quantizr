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
import { FormGroup } from "../widget/FormGroup";
import { TextField } from "../widget/TextField";
import { ConfirmDlg } from "./ConfirmDlg";
import { ResetPasswordDlg } from "./ResetPasswordDlg";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class LoginDlg extends DialogBase {

    constructor(paramsTest: Object, state: AppState) {
        super("Login", "app-modal-content-narrow-width", false, state);
        this.populateFromLocalDb();
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new FormGroup(null, [
                    new TextField("User", false, this.login, null, new CompValueHolder<string>(this, "user")),
                    new TextField("Password", true, this.login, null, new CompValueHolder<string>(this, "password"))
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
    }

    renderButtons(): CompIntf {
        return null;
    }

    populateFromLocalDb = async (): Promise<void> => {
        let user = await S.localDB.getVal(C.LOCALDB_LOGIN_USR);
        let password = await S.localDB.getVal(C.LOCALDB_LOGIN_PWD);

        this.mergeState({
            user,
            password
        });
       
        return null;
    }

    login = (): void => {
        let usr = this.getState().user;
        let pwd = this.getState().password;

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
        let usr = this.getState().user;

        new ConfirmDlg("Reset your password ?",
            "Confirm",
            () => {
                this.close();
                new ResetPasswordDlg(usr, this.appState).open();
            }, null, null, null, this.appState
        ).open();
    }
}
