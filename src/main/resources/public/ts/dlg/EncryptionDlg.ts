import { DialogBase } from "../DialogBase";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { Form } from "../widget/Form";
import { Constants as C} from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Checkbox } from "../widget/Checkbox";
import { VerticalLayout } from "../widget/VerticalLayout";
import { AppState } from "../AppState";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/**
 * Dialog to let user configure encryption for a node. 
 */
export class EncryptionDlg extends DialogBase {

    encryptAsPrivate: Checkbox;
  
    constructor(public encrypted: boolean, state: AppState) {
        super("Node Encryption", "app-modal-content-medium-width", false, false, state);
    }

    preRender = () => {
        this.setChildren([
            new Form(null, [
                new VerticalLayout([
                    this.encryptAsPrivate = new Checkbox("Encrypt Content", this.encrypted),
                ]),
                new ButtonBar([
                    new Button("Save", () => {
                        this.save();
                        this.close();
                    }, null, "btn-primary"),
                    new Button("Cancel", () => {
                        this.close();
                    })
                ])
            ])
        ]);
    }

    save = (): void => {
        this.encrypted = this.encryptAsPrivate.getChecked();
    }
}
