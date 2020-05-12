import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { TextField } from "../widget/TextField";
import { Form } from "../widget/Form";
import { FormGroup } from "../widget/FormGroup";
import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { DialogBase } from "../DialogBase";
import { TextContent } from "../widget/TextContent";
import { AppState } from "../AppState";
import { CompIntf } from "../widget/base/CompIntf";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class EditCredentialsDlg extends DialogBase {

    userTextField: TextField;
    passwordTextField: TextField;

    usr: string;
    pwd: string;

    constructor(title2: string, private usrDbProp: string, private pwdDbProp: string, state: AppState) {
        super(title2, "app-modal-content-narrow-width", false, state);
    }

    renderDlg(): CompIntf[] {
        this.userTextField = new TextField("User"),
        this.passwordTextField = new TextField("Password", null, true),

        this.populateFromLocalDb();

        return [
            new TextContent("Quantizr uses Temporal (https://temporal.cloud) as the storage provider for IPFS content, so you can enter your Temporal"+
            " credentials here to enable saving files permanently to IPFS."),
            new Form(null, [
                new FormGroup(null,
                    [
                        this.userTextField,
                        this.passwordTextField,
                    ]
                ),
                new ButtonBar(
                    [
                        new Button("Save", this.saveCreds, null, "btn-primary"),
                        new Button("Cancel", () => {
                            this.close();
                        })
                    ])

            ])
        ];
    }

    populateFromLocalDb = async (): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {
            try {
                this.userTextField.setValue(this.usr = await S.localDB.getVal(this.usrDbProp));
                this.passwordTextField.setValue(this.pwd = await S.localDB.getVal(this.pwdDbProp));
            }
            finally {
                resolve();
            }
        });
    }

    saveCreds = async (): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {
            this.usr = this.userTextField.getValue();
            this.pwd = this.passwordTextField.getValue();

            await S.localDB.setVal(this.usrDbProp, this.usr);
            await S.localDB.setVal(this.pwdDbProp, this.pwd);
            resolve();
            this.close();
        });
    }
}
