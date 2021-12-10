import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { ValidatedState } from "../ValidatedState";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/Button";
import { ButtonBar } from "../comp/ButtonBar";
import { Checkbox } from "../comp/Checkbox";
import { Form } from "../comp/Form";
import { HorizontalLayout } from "../comp/HorizontalLayout";
import { TextField } from "../comp/TextField";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

interface LS {
    recursive?: boolean;
}

export class TransferNodeDlg extends DialogBase {

    toUserState: ValidatedState<any> = new ValidatedState<any>();
    fromUserState: ValidatedState<any> = new ValidatedState<any>();

    constructor(state: AppState) {
        super("Transfer Node", "app-modal-content-narrow-width", false, state);
        this.mergeState<LS>({
            recursive: false
        });
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new HorizontalLayout([
                    // Only the admin user can transfer from anyone to anyone. Other users can only transfer nodes they own
                    this.appState.isAdminUser ? new TextField("From User", null, null, null, false, this.fromUserState) : null,
                    new TextField("To User", null, null, null, false, this.toUserState)
                ]),
                new HorizontalLayout([
                    new Checkbox("Include Sub-Nodes", null, {
                        setValue: (checked: boolean): void => {
                            this.mergeState<LS>({ recursive: checked });
                        },
                        getValue: (): boolean => {
                            return this.getState<LS>().recursive;
                        }
                    })
                ]),
                new ButtonBar([
                    new Button("Transfer", this.transfer, null, "btn-primary"),
                    new Button("Close", this.close)
                ], "marginTop")
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

    transfer = async () => {
        if (!this.validate()) {
            return;
        }

        let node: J.NodeInfo = S.nodeUtil.getHighlightedNode(this.appState);
        if (!node) {
            S.util.showMessage("No node was selected.", "Warning");
            return;
        }

        let res: J.TransferNodeResponse = await S.util.ajax<J.TransferNodeRequest, J.TransferNodeResponse>("transferNode", {
            recursive: this.getState<LS>().recursive,
            nodeId: node.id,
            fromUser: this.fromUserState.getValue(),
            toUser: this.toUserState.getValue()
        });

        S.view.refreshTree(null, false, false, null, false, true, true, true, false, this.appState);
        S.util.showMessage(res.message, "Success");
        this.close();
    }
}
