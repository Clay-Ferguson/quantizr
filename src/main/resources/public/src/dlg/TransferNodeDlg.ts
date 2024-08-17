import { getAs } from "../AppContext";
import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Checkbox } from "../comp/core/Checkbox";
import { Div } from "../comp/core/Div";
import { FlexRowLayout } from "../comp/core/FlexRowLayout";
import { TextField } from "../comp/core/TextField";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { Validator, ValidatorRuleName } from "../Validator";

interface LS { // Local State
    recursive?: boolean;
}

export class TransferNodeDlg extends DialogBase {
    toUserState: Validator = new Validator("", [
        { name: ValidatorRuleName.REQUIRED }
    ]);

    fromUserState: Validator = new Validator();

    constructor(private operation: string) {
        super(TransferNodeDlg.operationName(operation) + " Nodes", "appModalContNarrowWidth");
        this.mergeState<LS>({ recursive: false });

        if (operation === "transfer") {
            this.validatedStates = [this.toUserState];
        }
    }

    renderDlg(): Comp[] {
        return [
            new Div(null, null, [
                this.operation === "transfer" ? new FlexRowLayout([
                    // Only the admin user can transfer from anyone to anyone. Other users can only
                    // transfer nodes they own
                    getAs().isAdminUser ? new TextField({ label: "From User", val: this.fromUserState, outterClass: "marginRight" }) : null,
                    new TextField({ label: "To User", val: this.toUserState })
                ]) : null,
                new FlexRowLayout([
                    new Checkbox("Include Sub-Nodes", null, {
                        setValue: (checked: boolean) => this.mergeState<LS>({ recursive: checked }),
                        getValue: (): boolean => this.getState<LS>().recursive
                    })
                ], "marginTop"),
                new ButtonBar([
                    new Button(TransferNodeDlg.operationName(this.operation), this.transfer, null, "btn-primary"),
                    new Button("Close", this.close, null, "btn-secondary float-end")
                ], "marginTop")
            ])
        ];
    }

    static operationName(op: string) {
        switch (op) {
            case J.TransferOp.TRANSFER:
                return "Transfer";
            case J.TransferOp.ACCEPT:
                return "Accept";
            case J.TransferOp.REJECT:
                return "Reject";
            case J.TransferOp.RECLAIM:
                return "Reclaim";
            default:
                return "???";
        }
    }

    transfer = async () => {
        if (!this.validate()) {
            return;
        }

        const node = S.nodeUtil.getHighlightedNode();
        if (!node) {
            S.util.showMessage("No node was selected.", "Warning");
            return;
        }

        const res = await S.rpcUtil.rpc<J.TransferNodeRequest, J.TransferNodeResponse>("transferNode", {
            recursive: this.getState<LS>().recursive,
            nodeId: node.id,
            fromUser: this.fromUserState.getValue(),
            toUser: this.toUserState.getValue(),
            operation: this.operation
        });

        S.view.refreshTree({
            nodeId: null,
            zeroOffset: false,
            highlightId: null,
            scrollToTop: true,
            allowScroll: true,
            setTab: true,
            forceRenderParent: false,
            jumpToRss: false
        });
        S.util.showMessage(res.message, "Success");
        this.close();
    }
}
