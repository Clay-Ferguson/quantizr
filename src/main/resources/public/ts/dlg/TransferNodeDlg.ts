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
import { Checkbox } from "../widget/Checkbox";
import { Form } from "../widget/Form";
import { FormGroup } from "../widget/FormGroup";
import { TextField } from "../widget/TextField";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class TransferNodeDlg extends DialogBase {

    constructor(state: AppState) {
        super("Transfer Node", "app-modal-content-narrow-width", false, state);
        this.mergeState({
            recursive: false,
            fromUser: null,
            toUser: null
        });
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new FormGroup(null, [
                    new TextField("From User", null, null, null, new CompValueHolder<string>(this, "fromUser")),
                    new TextField("To User", null, null, null, new CompValueHolder<string>(this, "toUser"))
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
        let errors: any = {};
        let state = this.getState();

        if (!state.toUser) {
            errors.toUserNameTextValidationError = "Cannot be empty.";
            valid = false;
        }
        else {
            errors.toUserNameTextValidationError = null;
        }

        this.mergeState(errors);
        return valid;
    }

    renderButtons(): CompIntf {
        return null;
    }

    transfer = (): void => {
        if (!this.validate()) {
            return;
        }

        let state = this.getState();

        // if fromUser is left blank that's how to take ownership of any nodes regardless of current ownership
        if (/*! fromUser || */ !state.toUser) {
            S.util.showMessage("To user name is required.", "Warning");
            return;
        }
        let node: J.NodeInfo = S.meta64.getHighlightedNode(this.appState);
        if (!node) {
            S.util.showMessage("No node was selected.", "Warning");
            return;
        }

        S.user.transferNode(this.getState().recursive, node.id, state.fromUser, state.toUser, this.appState);
        this.close();
    }
}
