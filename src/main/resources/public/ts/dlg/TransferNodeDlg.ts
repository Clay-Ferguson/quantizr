import * as J from "../JavaIntf";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { TextField } from "../widget/TextField";
import { Form } from "../widget/Form";
import { FormGroup } from "../widget/FormGroup";
import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { DialogBase } from "../DialogBase";
import { Checkbox } from "../widget/Checkbox";
import { AppState } from "../AppState";
import { CompIntf } from "../widget/base/CompIntf";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class TransferNodeDlg extends DialogBase {

    fromTextField: TextField;
    toTextField: TextField;

    constructor(state: AppState) {
        super("Transfer Node", "app-modal-content-narrow-width", false, state);
        this.mergeState({recursive: false});
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new FormGroup(null, [
                    this.fromTextField = new TextField("From User"),
                    this.toTextField = new TextField("To User"),
                ]),
                new FormGroup(null, [
                    new Checkbox("Include Sub-Nodes", null, {
                        setValue: (checked: boolean): void => {
                            this.mergeState({recursive: checked});
                        },
                        getValue: (): boolean => {
                            return this.getState().recursive;
                        }
                    }),
                ]),
                new ButtonBar([
                    new Button("Transfer", this.transfer, null, "btn-primary"),
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

    transfer = (): void => {
        let fromUser = this.fromTextField.getValue();
        let toUser = this.toTextField.getValue();
        //if fromUser is left blank that's how to take ownership of any nodes regardless of current ownership
        if (/*!fromUser ||*/ !toUser) {
            S.util.showMessage("To user name is required.", "Warning");
            return;
        }
        let node: J.NodeInfo = S.meta64.getHighlightedNode(this.appState);
        if (!node) {
            S.util.showMessage("No node was selected.", "Warning");
            return;
        }
       
        S.user.transferNode(this.getState().recursive, node.id, fromUser, toUser, this.appState);
        this.close();
    }
}
