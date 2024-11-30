import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Checkbox } from "../comp/core/Checkbox";
import { Div } from "../comp/core/Div";
import { RadioButton } from "../comp/core/RadioButton";
import { RadioButtonGroup } from "../comp/core/RadioButtonGroup";
import { TextField } from "../comp/core/TextField";
import { DialogBase } from "../DialogBase";
import { S } from "../Singletons";
import { Validator } from "../Validator";

interface LS { // Local State
    recursive?: boolean;
    action?: "addHashtags" | "removeHashtags";
}

export class ModifySubGraphDlg extends DialogBase {
    hashtags: Validator = new Validator();

    constructor() {
        super("Modify SubGraph", "appModalContNarrowWidth");
        this.mergeState<LS>({ recursive: true, action: "addHashtags" });
    }

    renderDlg(): Comp[] {
        return [
            new Div(null, null, [
                new TextField({ label: "Hashtags", val: this.hashtags }),
                new Div(null, { className: "mt-3" }, [
                    new Checkbox("Include Sub-Nodes", null, {
                        setValue: (checked: boolean) => this.mergeState<LS>({ recursive: checked }),
                        getValue: (): boolean => this.getState<LS>().recursive
                    })
                ]),
                new RadioButtonGroup([
                    new RadioButton("Add Hashtags", false, "actionGroup", null, {
                        setValue: (checked: boolean) => {
                            if (checked) {
                                this.mergeState<LS>({ action: "addHashtags" });
                            }
                        },
                        getValue: (): boolean => this.getState<LS>().action === "addHashtags"
                    }),
                    new RadioButton("Remove Hashtags", true, "actionGroup", null, {
                        setValue: (checked: boolean) => {
                            if (checked) {
                                this.mergeState<LS>({ action: "removeHashtags" });
                            }
                        },
                        getValue: (): boolean => this.getState<LS>().action === "removeHashtags"
                    })
                ], "formGrpBorder modifyActionsRadioButtonGroup"),
                new ButtonBar([
                    new Button("Modify", this._modify, null, "-primary"),
                    new Button("Cancel", this._close, null, "float-right")
                ], "mt-3")
            ])
        ];
    }

    _modify = () => {
        if (!this.validate()) {
            return;
        }
        const node = S.nodeUtil.getHighlightedNode();
        if (!node) {
            S.util.showMessage("No node was selected.", "Warning");
            return;
        }
        S.srch.modifySubGraph(this.getState<LS>().recursive, node.id, this.hashtags.getValue(), this.getState<LS>().action);
        this.close();
    }
}
