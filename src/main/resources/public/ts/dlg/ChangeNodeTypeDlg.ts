import { getAppState } from "../AppRedux";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Form } from "../comp/core/Form";
import { NodeTypeListBox } from "../comp/NodeTypeListBox";
import { DialogBase } from "../DialogBase";
import { ValueIntf } from "../Interfaces";

interface LS { // Local State
    selType: string;
}

export class ChangeNodeTypeDlg extends DialogBase {

    valIntf: ValueIntf;
    selCallback: Function = null;
    inlineButton: Button;

    constructor(curType: string, selCallback: Function) {
        super("Set Node Type", "app-modal-content-narrow-width");
        this.selCallback = selCallback;

        this.valIntf = {
            setValue: (val: string) => this.mergeState<LS>({ selType: val }),
            getValue: (): string => this.getState<LS>().selType
        };

        this.mergeState<LS>({ selType: curType || "u" });
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new NodeTypeListBox(this.valIntf, getAppState()),
                new ButtonBar([
                    new Button("Set Type", this.setNodeType, null, "btn-primary"),
                    new Button("Cancel", this.close)
                ], "marginTop")
            ])
        ];
    }

    setNodeType = () => {
        this.selCallback(this.getState<LS>().selType);
        this.close();
    }
}
