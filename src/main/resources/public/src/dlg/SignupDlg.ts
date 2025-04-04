import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { ValHolder, ValidatorRuleName } from "../ValHolder";
import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { FlexRowLayout } from "../comp/core/FlexRowLayout";
import { Img } from "../comp/core/Img";
import { TextField } from "../comp/core/TextField";

export class SignupDlg extends DialogBase {

    userNameState: ValHolder = new ValHolder("", [
        { name: ValidatorRuleName.REQUIRED },
        { name: ValidatorRuleName.MINLEN, payload: 3 },
        { name: ValidatorRuleName.MAXLEN, payload: 100 },
        { name: ValidatorRuleName.USERNAME }
    ]);

    passwordState: ValHolder = new ValHolder("", [
        { name: ValidatorRuleName.MINLEN, payload: 5 },
        { name: ValidatorRuleName.MAXLEN, payload: 40 },
        { name: ValidatorRuleName.REQUIRED }
    ]);

    emailState: ValHolder = new ValHolder("", [
        { name: ValidatorRuleName.REQUIRED },
        { name: ValidatorRuleName.MINLEN, payload: 5 },
        { name: ValidatorRuleName.MAXLEN, payload: 100 }
    ]);

    captchaState: ValHolder = new ValHolder("", [{ name: ValidatorRuleName.REQUIRED }]);

    constructor(private adminCreatingUser: boolean = false) {
        super("Create Account", "appModalContMediumWidth");
        this.validatedStates = [this.userNameState, this.passwordState, this.emailState, this.captchaState];
    }

    renderDlg(): Comp[] {
        return [
            new Div(null, null, [
                new TextField({ label: "User Name", val: this.userNameState }),
                new TextField({ label: "Password", inputType: "password", val: this.passwordState }),
                new TextField({ label: "Email", val: this.emailState }),

                this.adminCreatingUser ? null : new FlexRowLayout([
                    new Img({
                        // cb=cache buster
                        src: window.location.origin + "/api/captcha?cb=" + new Date().getTime(),
                        className: "captchaImage"
                    }),
                    new Div(null, null, [
                        new TextField({ label: "Captcha", val: this.captchaState })
                    ])
                ], "captchaPanel mt-3"),
                new ButtonBar([
                    new Button("Create Account", this._signup, null, "-primary"),
                    new Button("Cancel", this._close, { className: "float-right" })
                ], "mt-3")
            ])
        ];
    }

    _signup = async () => {
        if (this.adminCreatingUser) {
            // this string is just to make the validator succeed, and used as an extra confirmation
            // on the server that the intent of the admin is the creation of a new user. This is not
            // a security risk, but is safe in terms of security, because the server side also
            // confirms independently that this is the admin doing this.
            this.captchaState.setValue("adminCreatingUser");
        }

        if (!this.validate()) {
            return;
        }

        const res = await S.rpcUtil.rpc<J.SignupRequest, J.SignupResponse>("signup", {
            userName: this.userNameState.getValue(),
            password: this.passwordState.getValue(),
            email: this.emailState.getValue(),
            captcha: this.captchaState.getValue()
        });

        if (res.code == C.RESPONSE_CODE_OK) {
            this.close();

            if (this.adminCreatingUser) {
                await S.util.showMessage("User '" + this.userNameState.getValue() + "' created successfully.", "New User");
            }
            else {
                await S.util.showMessage(
                    "Check your email for verification link.", "Welcome to " + S.quanta.config.brandingAppName + "!"
                );

                window.location.href = window.location.origin;
            }
        }
        else {
            this.userNameState.setError(res.userError);
            this.passwordState.setError(res.passwordError);
            this.emailState.setError(res.emailError);
            this.captchaState.setError(res.captchaError);
        }
    }
}
