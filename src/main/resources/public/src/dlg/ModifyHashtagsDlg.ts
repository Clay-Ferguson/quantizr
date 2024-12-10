import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { RadioButton } from "../comp/core/RadioButton";
import { RadioButtonGroup } from "../comp/core/RadioButtonGroup";
import { TextField } from "../comp/core/TextField";
import { DialogBase } from "../DialogBase";
import { S } from "../Singletons";
import { ValHolder } from "../ValHolder";
import { SelectTagsDlg } from "./SelectTagsDlg";

interface LS { // Local State
    action?: "addHashtags" | "removeHashtags" | "clearAllHashtags";
    targetSet?: "children" | "recursive";
}

export class ModifyHashtags extends DialogBase {
    hashtags: ValHolder = new ValHolder();

    constructor() {
        super("Modify Hashtags", "appModalContNarrowWidth");
        this.mergeState<LS>({ targetSet: "recursive", action: "addHashtags" });
    }

    renderDlg(): Comp[] {
        const node = S.nodeUtil.getHighlightedNode();
        return [
            new Div(null, null, [
                new TextField({ label: "Hashtags", val: this.hashtags }),
                new Button("Hashtags", async () => {
                    const dlg = new SelectTagsDlg("search", this.hashtags.getValue(), true, node?.id);
                    await dlg.open();
                    let val = dlg.addTagsToString(this.hashtags.getValue());
                    // remove all double quotes from val
                    val = val.replace(/"/g, "");
                    this.hashtags.setValue(val);
                }, {
                    title: "Select Hashtags to Search"
                }, "-primary mb-3", "fa-tag fa-lg"),
                new RadioButtonGroup([
                    new RadioButton("Recursive", true, "targetSetGroup", null, {
                        setValue: (checked: boolean) => {
                            if (checked) {
                                this.mergeState<LS>({ targetSet: "recursive" });
                            }
                        },
                        getValue: (): boolean => this.getState<LS>().targetSet === "recursive"
                    }),
                    new RadioButton("Children Only", false, "targetSetGroup", null, {
                        setValue: (checked: boolean) => {
                            if (checked) {
                                this.mergeState<LS>({ targetSet: "children" });
                            }
                        },
                        getValue: (): boolean => this.getState<LS>().targetSet === "children"
                    }),
                ], "formGrpBorder modifyActionsRadioButtonGroup"),
                new RadioButtonGroup([
                    new RadioButton("Add", false, "actionGroup", null, {
                        setValue: (checked: boolean) => {
                            if (checked) {
                                this.mergeState<LS>({ action: "addHashtags" });
                            }
                        },
                        getValue: (): boolean => this.getState<LS>().action === "addHashtags"
                    }),
                    new RadioButton("Remove", true, "actionGroup", null, {
                        setValue: (checked: boolean) => {
                            if (checked) {
                                this.mergeState<LS>({ action: "removeHashtags" });
                            }
                        },
                        getValue: (): boolean => this.getState<LS>().action === "removeHashtags"
                    }),
                    new RadioButton("Clear All", true, "actionGroup", null, {
                        setValue: (checked: boolean) => {
                            if (checked) {
                                this.mergeState<LS>({ action: "clearAllHashtags" });
                            }
                        },
                        getValue: (): boolean => this.getState<LS>().action === "clearAllHashtags"
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
        let val = this.hashtags.getValue();
        // remove all double quotes from val
        val = val.replace(/"/g, "");
        S.srch.modifySubGraph(this.getState<LS>().targetSet, node.id, this.hashtags.getValue(), this.getState<LS>().action);
        this.close();
    }
}
