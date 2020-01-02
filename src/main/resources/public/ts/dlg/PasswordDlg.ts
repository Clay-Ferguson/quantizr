import { DialogBase } from "../DialogBase";
import { PasswordTextField } from "../widget/PasswordTextField";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { Constants } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { TextField } from "../widget/TextField";
import { TextContent } from "../widget/TextContent";

let S : Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* This is the password dialog for storing Master Encryption Key that is used to encrypt all passwords Quantizr manages. */
export class PasswordDlg extends DialogBase {
    passwordTextField: PasswordTextField;
    textField: TextField;
    password: string;
  
    constructor(paramsTest: Object) {
        super("Encryption Master Password");
        
        this.setChildren([
            new TextContent("Enter the password that is the master encryption key for accessing all other passwords that Quantizr manages for your account.<br><br>"+
            "Note: Your browser password manager will store this under 'Master Password'"),
            this.textField = new TextField({
                style : {display: "none"},
                label: "Username"
            }, "Master Password"),
            this.passwordTextField = new PasswordTextField({
                placeholder: "",
                label: "Password",
                onKeyPress : (e) => {
                    if (e.which == 13) { // 13==enter key code
                        this.okButton();
                        return false;
                    }
                }
            }),
            new ButtonBar([
                new Button("Ok", this.okButton),
                new Button("Close", () => {
                    this.close();
                })
            ])
        ]);
    }

    
    okButton = (): void => {
        this.password = this.passwordTextField.getValue();
        this.close();
    }

    getPasswordVal = (): string => {
        return this.password;
    }
}
