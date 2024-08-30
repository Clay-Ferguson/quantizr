import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { Validator } from "../Validator";
import { Comp, ScrollPos } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { TextArea } from "../comp/core/TextArea";

export class SetNodeUsingJsonDlg extends DialogBase {
    textState: Validator = new Validator();
    textScrollPos = new ScrollPos();

    constructor(private nodeId: string) {
        super("Set Node JSON");
    }

    renderDlg(): Comp[] {
        return [
            new Div(null, null, [
                new Div("Enter the new JSON for the Node"),
                new TextArea(null, { rows: 15 }, this.textState, null, false, 3, this.textScrollPos),
                new ButtonBar([
                    new Button("Save", this.save, null, "btn-primary"),
                    new Button("Close", this._close, null, "btn-secondary float-end")
                ], "marginTop")
            ])
        ];
    }

    reload = async () => {
        const res = await S.rpcUtil.rpc<J.GetNodeJsonRequest, J.GetNodeJsonResponse>("getNodeJson", {
            nodeId: this.nodeId
        });

        this.textState.setValue(res.json);
    }

    save = async () => {
        const json = this.textState.getValue();
        await S.rpcUtil.rpc<J.SaveNodeJsonRequest, J.SaveNodeJsonResponse>("saveNodeJson", {
            json
        });
        this.close();
        S.quanta.refresh();
    }

    override async preLoad(): Promise<void> {
        await this.reload();
    }
}
