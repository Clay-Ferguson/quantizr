import { AppState } from "../AppState";
import { DialogBase } from "../DialogBase";
import { ValueIntf } from "../Interfaces";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Form } from "../widget/Form";
import { NodeTypeListBox } from "../widget/NodeTypeListBox";

interface LS {
    selType: string;
}

export class ChangeNodeTypeDlg extends DialogBase {

    selTypeValueIntf: ValueIntf;
    selCallback: Function = null;
    inlineButton: Button;

    constructor(curType: string, selCallback: Function, state: AppState) {
        super("Set Node Type", "app-modal-content-narrow-width", false, state);
        this.selCallback = selCallback;

        this.selTypeValueIntf = {
            setValue: (val: string): void => {
                this.mergeState<LS>({ selType: val });
            },

            getValue: (): string => {
                return this.getState<LS>().selType;
            }
        };

        this.mergeState<LS>({ selType: curType || "u" });
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new NodeTypeListBox(this.selTypeValueIntf, this.appState),
                new ButtonBar([
                    new Button("Set Type", this.setNodeType, null, "btn-primary"),
                    new Button("Cancel", this.close)
                ], "marginTop")
            ])
        ];
    }

    setNodeType = (): void => {
        this.selCallback(this.getState<LS>().selType);
        this.close();
    }
}
