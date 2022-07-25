import { AppState } from "../AppState";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Checkbox } from "../comp/core/Checkbox";
import { Form } from "../comp/core/Form";
import { HorizontalLayout } from "../comp/core/HorizontalLayout";
import { TextField } from "../comp/core/TextField";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { ValidatedState } from "../ValidatedState";

interface LS { // Local State
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
                    this.appState.isAdminUser ? new TextField({ label: "From User", val: this.fromUserState }) : null,
                    new TextField({ label: "To User", val: this.toUserState })
                ]),
                new HorizontalLayout([
                    new Checkbox("Include Sub-Nodes", null, {
                        setValue: (checked: boolean) => {
                            this.mergeState<LS>({ recursive: checked });
                        },
                        getValue: (): boolean => {
                            return this.getState<LS>().recursive;
                        }
                    })
                ]),
                new ButtonBar([
                    new Button("Transfer", this.transfer, null, "btn-primary"),
                    new Button("Close", this.close, null, "btn-secondary float-end")
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

        let res = await S.util.ajax<J.TransferNodeRequest, J.TransferNodeResponse>("transferNode", {
            recursive: this.getState<LS>().recursive,
            nodeId: node.id,
            fromUser: this.fromUserState.getValue(),
            toUser: this.toUserState.getValue()
        });

        S.view.refreshTree({
            nodeId: null,
            zeroOffset: false,
            renderParentIfLeaf: false,
            highlightId: null,
            forceIPFSRefresh: false,
            scrollToTop: true,
            allowScroll: true,
            setTab: true,
            forceRenderParent: false,
            state: this.appState
        });
        S.util.showMessage(res.message, "Success");
        this.close();
    }
}
