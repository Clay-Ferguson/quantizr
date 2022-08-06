import { getAppState } from "../AppRedux";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Checkbox } from "../comp/core/Checkbox";
import { Div } from "../comp/core/Div";
import { HorizontalLayout } from "../comp/core/HorizontalLayout";
import { TextField } from "../comp/core/TextField";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { ValidatedState, ValidatorRuleName } from "../ValidatedState";

interface LS { // Local State
    recursive?: boolean;
}

export class TransferNodeDlg extends DialogBase {
    toUserState: ValidatedState = new ValidatedState("", [
        { name: ValidatorRuleName.REQUIRED }
    ]);

    fromUserState: ValidatedState = new ValidatedState();

    constructor() {
        super("Transfer Node", "app-modal-content-narrow-width");
        this.mergeState<LS>({ recursive: false });
        this.validatedStates = [this.toUserState];
    }

    renderDlg(): CompIntf[] {
        return [
            new Div(null, null, [
                new HorizontalLayout([
                    // Only the admin user can transfer from anyone to anyone. Other users can only transfer nodes they own
                    getAppState().isAdminUser ? new TextField({ label: "From User", val: this.fromUserState }) : null,
                    new TextField({ label: "To User", val: this.toUserState })
                ]),
                new HorizontalLayout([
                    new Checkbox("Include Sub-Nodes", null, {
                        setValue: (checked: boolean) => this.mergeState<LS>({ recursive: checked }),
                        getValue: (): boolean => this.getState<LS>().recursive
                    })
                ]),
                new ButtonBar([
                    new Button("Transfer", this.transfer, null, "btn-primary"),
                    new Button("Close", this.close, null, "btn-secondary float-end")
                ], "marginTop")
            ])
        ];
    }

    transfer = async () => {
        if (!this.validate()) {
            return;
        }

        const node = S.nodeUtil.getHighlightedNode(getAppState());
        if (!node) {
            S.util.showMessage("No node was selected.", "Warning");
            return;
        }

        const res = await S.util.ajax<J.TransferNodeRequest, J.TransferNodeResponse>("transferNode", {
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
            state: getAppState()
        });
        S.util.showMessage(res.message, "Success");
        this.close();
    }
}
