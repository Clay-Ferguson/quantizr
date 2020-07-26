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
import { CompValueHolder } from "../CompValueHolder";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class LoginDlg extends DialogBase {

    constructor(paramsTest: Object, state: AppState) {
        super("Login", "app-modal-content-narrow-width", false, state);

        //todo-0: CHECK ALL OTHER DIALOGS FOR THIS TYPE OF MISTAKE.
        //beware: don't put this in a RENDER method. That will cause a massive problem (infinite loop, or hang in rendering)
        this.populateFromLocalDb();
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new FormGroup(null, [
                    new TextField("User", false, this.login, new CompValueHolder<string>(this, "user")),
                    new TextField("Password", true, this.login, new CompValueHolder<string>(this, "password"))
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
        })
       
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
                this.close()
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
