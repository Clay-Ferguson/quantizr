import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { TextField } from "../comp/core/TextField";
import { NodeTypeListBox } from "../comp/NodeTypeListBox";
import { DialogBase } from "../DialogBase";
import { ValueIntf } from "../Interfaces";
import * as J from "../JavaIntf";
import { Validator } from "../Validator";

interface LS { // Local State
    selType?: string;
}

// todo-0: rename to PickNodeType
export class ChangeNodeTypeDlg extends DialogBase {

    searchTextState: Validator = new Validator();
    searchTextField: TextField;

    valIntf: ValueIntf;
    selCallback: Function = null;
    inlineButton: Button;

    static inst: ChangeNodeTypeDlg = null;
    static searchDirty = false;
    static dirtyCounter = 0;
    static interval = setInterval(() => {
        if (!ChangeNodeTypeDlg.inst) return;
        if (ChangeNodeTypeDlg.searchDirty) {
            ChangeNodeTypeDlg.dirtyCounter++;
            if (ChangeNodeTypeDlg.dirtyCounter >= 2) {
                ChangeNodeTypeDlg.searchDirty = false;
                setTimeout(ChangeNodeTypeDlg.inst.typeSearch, 10);
            }
        }
    }, 500);

    constructor(curType: string, selCallback: Function) {
        super("Set Node Type", "app-modal-content-narrow-width");
        this.selCallback = selCallback;
        ChangeNodeTypeDlg.inst = this;

        this.valIntf = {
            setValue: (val: string) => this.mergeState<LS>({ selType: val }),
            getValue: (): string => this.getState<LS>().selType
        };

        this.mergeState<LS>({ selType: curType || J.NodeType.NONE });

        this.searchTextState.v.onStateChange = (val: any) => {
            ChangeNodeTypeDlg.searchDirty = true;
            ChangeNodeTypeDlg.dirtyCounter = 0;
        };
    }

    renderDlg(): CompIntf[] {
        return [
            new Div(null, null, [
                (this.searchTextField = new TextField({
                    labelClass: "txtFieldLabelShort",
                    val: this.searchTextState,
                    placeholder: "Search for...",
                    enter: this.typeSearch,
                    outterClass: "typeSearchField"
                })),
                new NodeTypeListBox(this.valIntf, this.searchTextState.getValue()),
                new ButtonBar([
                    new Button("Set Type", this.setNodeType, null, "btn-primary"),
                    new Button("Cancel", this.close)
                ], "marginTop")
            ])
        ];
    }

    typeSearch = () => {
        this.mergeState<LS>({});
        // warning: keep the fat arrow function here.
        setTimeout(() => this.searchTextField.focus(), 50);
    }

    setNodeType = () => {
        this.selCallback(this.getState<LS>().selType);
        this.close();
    }
}
