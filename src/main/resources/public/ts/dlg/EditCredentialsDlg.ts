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
import { CompValueHolder } from "../CompValueHolder";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class EditCredentialsDlg extends DialogBase {

    constructor(title2: string, private usrDbProp: string, private pwdDbProp: string, state: AppState) {
        super(title2, "app-modal-content-narrow-width", false, state);
        this.populateFromLocalDb();
    }

    renderDlg(): CompIntf[] {
        return [
            new TextContent("Quanta uses Temporal (https://temporal.cloud) as the storage provider for IPFS content, so you can enter your Temporal" +
                " credentials here to enable saving files permanently to IPFS."),
            new Form(null, [
                new FormGroup(null, [
                    new TextField("User", null, false, null, new CompValueHolder<string>(this, "user")),
                    new TextField("Password", null, true, null, new CompValueHolder<string>(this, "password"))
                ]),
                new ButtonBar([
                    new Button("Save", this.saveCreds, null, "btn-primary"),
                    new Button("Cancel", () => {
                        this.close();
                    })
                ])
            ])
        ];
    }

    renderButtons(): CompIntf {
        return null;
    }

    populateFromLocalDb = async () => {
        this.mergeState({
            user: await S.localDB.getVal(this.usrDbProp),
            password: await S.localDB.getVal(this.pwdDbProp)
        })
    }

    saveCreds = async () => {
        await S.localDB.setVal(this.usrDbProp, this.getState().user);
        await S.localDB.setVal(this.pwdDbProp, this.getState().password);
        this.close();
    }
}
