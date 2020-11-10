import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { ValidatedState } from "../ValidatedState";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Checkbox } from "../widget/Checkbox";
import { Form } from "../widget/Form";
import { FormGroup } from "../widget/FormGroup";
import { TextField } from "../widget/TextField";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class TransferNodeDlg extends DialogBase {

    toUserState: ValidatedState<any> = new ValidatedState<any>();
    fromUserState: ValidatedState<any> = new ValidatedState<any>();

    constructor(state: AppState) {
        super("Transfer Node", "app-modal-content-narrow-width", false, state);
        this.mergeState({
            recursive: false
        });
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new FormGroup(null, [
                    new TextField("From User", null, null, null, false, this.fromUserState),
                    new TextField("To User", null, null, null, false, this.toUserState)
                ]),
                new FormGroup(null, [
                    new Checkbox("Include Sub-Nodes", null, {
                        setValue: (checked: boolean): void => {
                            this.mergeState({ recursive: checked });
                        },
                        getValue: (): boolean => {
                            return this.getState().recursive;
                        }
                    })
                ]),
                new ButtonBar([
                    new Button("Transfer", this.transfer, null, "btn-primary"),
                    new Button("Close", this.close)
                ])
            ])
        ];
    }

    validate = (): boolean => {
        let valid = true;

        if (!this.toUserState.getValue()) {
            this.toUserState.setError("Cannot be empty.");
            valid = false;
        }
        else {
            this.toUserState.setError(null);
        }
        return valid;
    }

    renderButtons(): CompIntf {
        return null;
    }

    transfer = (): void => {
        if (!this.validate()) {
            return;
        }

        let node: J.NodeInfo = S.meta64.getHighlightedNode(this.appState);
        if (!node) {
            S.util.showMessage("No node was selected.", "Warning");
            return;
        }

        S.user.transferNode(this.getState().recursive, node.id, this.fromUserState.getValue(), this.toUserState.getValue(), this.appState);
        this.close();
    }
}
