import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { RadioButton } from "../comp/core/RadioButton";
import { RadioButtonGroup } from "../comp/core/RadioButtonGroup";
import { TextContent } from "../comp/core/TextContent";
import { TextField } from "../comp/core/TextField";
import { DialogBase } from "../DialogBase";
import { NodeInfo } from "../JavaIntf";
import { S } from "../Singletons";
import { ValHolder } from "../ValHolder";

interface LS { // Local State
    splitMode?: string;
    splitType?: string;
    delimiter?: string;
}

export class SplitNodeDlg extends DialogBase {
    delimiterState: ValHolder = new ValHolder();

    constructor(private node: NodeInfo) {
        super("Split Node");
        this.node = this.node || S.nodeUtil.getHighlightedNode();

        let splitMode: string;
        if (this.node.content.indexOf("\n\n\n") !== -1) {
            splitMode = "triple";
        }
        else if (this.node.content.indexOf("\n\n") !== -1) {
            splitMode = "double";
        }
        else {
            splitMode = "custom";
        }

        this.mergeState<LS>({
            splitMode,
            splitType: "inline",
            delimiter: "{split}"
        });
    }

    renderDlg(): Comp[] {
        return [
            new TextContent("Split into multiple nodes..."),

            new RadioButtonGroup([
                new RadioButton("Split Inline", false, "splitTypeGroup", null, {
                    setValue: (checked: boolean) => {
                        if (checked) {
                            this.mergeState<LS>({ splitType: "inline" });
                        }
                    },
                    getValue: (): boolean => this.getState<LS>().splitType === "inline"
                }),
                new RadioButton("Split into Children", true, "splitTypeGroup", null, {
                    setValue: (checked: boolean) => {
                        if (checked) {
                            this.mergeState<LS>({ splitType: "children" });
                        }
                    },
                    getValue: (): boolean => this.getState<LS>().splitType === "children"
                })
            ], "formGrpBorder splitNodeRadioButtonGroup"),

            new RadioButtonGroup([
                new RadioButton("Single Blank Line", true, "splitSpacingGroup", null, {
                    setValue: (checked: boolean) => {
                        if (checked) {
                            this.mergeState<LS>({ splitMode: "double" });
                        }
                    },
                    getValue: (): boolean => this.getState<LS>().splitMode === "double"
                }),
                new RadioButton("Double Blank Line", false, "splitSpacingGroup", null, {
                    setValue: (checked: boolean) => {
                        if (checked) {
                            this.mergeState<LS>({ splitMode: "triple" });
                        }
                    },
                    getValue: (): boolean => this.getState<LS>().splitMode === "triple"
                }),
                new RadioButton("Custom Delimiter", false, "splitSpacingGroup", null, {
                    setValue: (checked: boolean) => {
                        if (checked) {
                            this.mergeState<LS>({ splitMode: "custom" });
                        }
                    },
                    getValue: (): boolean => this.getState<LS>().splitMode === "custom"
                })
            ], "formGrpBorder splitNodeRadioButtonGroup"),

            (this.getState<LS>().splitMode === "custom") ? new TextField({ label: "Delimiter", val: this.delimiterState }) : null,

            new ButtonBar([
                new Button("Split", this._splitNodes, null, "-primary"),
                new Button("Cancel", this._close)
            ], "mt-3")
        ];
    }

    _splitNodes = () => {
        const state = this.getState<LS>();

        let delim = "";
        if (state.splitMode === "double") {
            delim = "\n\n";
        }
        else if (state.splitMode === "triple") {
            delim = "\n\n\n";
        }
        else if (state.splitMode === "custom") {
            delim = this.delimiterState.getValue();
        }

        S.edit.splitNode(this.node, state.splitType, delim);
        this.close();
    }
}
