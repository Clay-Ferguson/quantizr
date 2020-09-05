import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { BaseCompState } from "../widget/base/BaseCompState";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Form } from "../widget/Form";
import { FormGroup } from "../widget/FormGroup";
import { TextContent } from "../widget/TextContent";
import { TextField } from "../widget/TextField";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* todo-td: This class is the prototype/example for how to do perfectly type-safe editing where a component has a typed state object
bound to it all they way to the core Comp.state */

interface EditCredentialsDlgState extends BaseCompState {
    user?: string;
    password?: string;
}

export class EditCredentialsDlg extends DialogBase<EditCredentialsDlgState> {

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
                    new TextField("User", false, null, {
                        getValue: (): string => {
                            return this.getState().user;
                        },
                        setValue: (val: string): void => {
                            this.mergeState({user: val});
                        }
                    }),
                    new TextField("Password", true, null, {
                        getValue: (): string => {
                            return this.getState().password;
                        },
                        setValue: (val: string): void => {
                            this.mergeState({password: val});
                        }
                    })
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
