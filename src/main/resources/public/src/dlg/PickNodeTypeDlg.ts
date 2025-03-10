import { dispatch, getAs } from "../AppContext";
import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Checkbox } from "../comp/core/Checkbox";
import { Div } from "../comp/core/Div";
import { TextField } from "../comp/core/TextField";
import { NodeTypeListBox } from "../comp/NodeTypeListBox";
import { DialogBase } from "../DialogBase";
import { ValueIntf } from "../Interfaces";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { ValHolder } from "../ValHolder";

interface LS { // Local State
    selType?: string;
}

export class PickNodeTypeDlg extends DialogBase {

    searchTextState: ValHolder = new ValHolder();
    searchTextField: TextField;

    valIntf: ValueIntf;
    chosenType: string = null;
    inlineButton: Button;

    static inst: PickNodeTypeDlg = null;
    static searchDirty = false;
    static dirtyCounter = 0;
    static interval = setInterval(() => {
        if (!PickNodeTypeDlg.inst) return;
        if (PickNodeTypeDlg.searchDirty) {
            PickNodeTypeDlg.dirtyCounter++;
            if (PickNodeTypeDlg.dirtyCounter >= 2) {
                PickNodeTypeDlg.searchDirty = false;
                setTimeout(PickNodeTypeDlg.inst._typeSearch, 10);
            }
        }
    }, 500);

    constructor(curType: string) {
        super("Choose Type", "appModalContNarrowWidth");
        PickNodeTypeDlg.inst = this;

        this.valIntf = {
            setValue: (val: string) => this.mergeState<LS>({ selType: val }),
            getValue: (): string => this.getState<LS>().selType
        };

        this.mergeState<LS>({ selType: curType || J.NodeType.NONE });

        this.searchTextState.v.onStateChange = (_val: any) => {
            PickNodeTypeDlg.searchDirty = true;
            PickNodeTypeDlg.dirtyCounter = 0;
        };
    }

    renderDlg(): Comp[] {
        return [
            new Div(null, null, [
                (this.searchTextField = new TextField({
                    labelClass: "txtFieldLabelShort",
                    val: this.searchTextState,
                    placeholder: "Search for...",
                    enter: this._typeSearch,
                    outterClass: "typeSearchField"
                })),
                new Checkbox("Schema.org", { className: "mr-3" }, {
                    setValue: (checked: boolean) => dispatch("SetSchemaOrgProps", s => { s.showSchemaOrgProps = checked; }),
                    getValue: (): boolean => getAs().showSchemaOrgProps
                }),
                new Checkbox("Recent", { className: "mr-3" }, {
                    setValue: (checked: boolean) => dispatch("RecentProps", s => { s.showRecentProps = checked; }),
                    getValue: (): boolean => getAs().showRecentProps
                }),
                new NodeTypeListBox(this.valIntf, this.searchTextState.getValue()),
                new ButtonBar([
                    new Button("Ok", this._setNodeType, null, "-primary"),
                    new Button("Cancel", this._close)
                ], "mt-3")
            ])
        ];
    }

    _typeSearch = () => {
        this.mergeState<LS>({});
        // warning: keep the fat arrow function here.
        setTimeout(() => this.searchTextField.focus(), 50);
    }

    _setNodeType = () => {
        this.chosenType = this.getState<LS>().selType;
        S.props.addRecentType(this.chosenType);
        this.close();
    }
}
