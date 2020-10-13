import { compose } from "redux";
import { AppState } from "../AppState";
import { DialogBase } from "../DialogBase";
import { ValueIntf } from "../Interfaces";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Form } from "../widget/Form";
import { NodeTypeListBox } from "../widget/NodeTypeListBox";

export class ChangeNodeTypeDlg extends DialogBase {

    selTypeValueIntf: ValueIntf;
    selCallback: Function = null;
    inlineButton: Button;

    constructor(curType: string, selCallback: Function, state: AppState) {
        super("Set Node Type", "app-modal-content-narrow-width", false, state);
        this.selCallback = selCallback;

        this.selTypeValueIntf = {
            setValue: (val: string): void => {
                this.mergeState({ selType: val });
            },

            getValue: (): string => {
                return this.getState().selType;
            }
        };

        this.mergeState({ selType: curType || "u" });
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new NodeTypeListBox(this.selTypeValueIntf, this.appState),
                new ButtonBar([
                    new Button("Set Type", this.setNodeType, null, "btn-primary"),
                    new Button("Cancel", this.close)
                ])
            ])
        ];
    }

    renderButtons(): CompIntf {
        return null;
    }

    setNodeType = (): void => {
        // console.log("accepting TypeSelected: " + this.getState().selType);
        this.selCallback(this.getState().selType);
        this.close();
    }
}
