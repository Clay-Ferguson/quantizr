import { AppState } from "../AppState";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { RadioButton } from "../comp/core/RadioButton";
import { RadioButtonGroup } from "../comp/core/RadioButtonGroup";
import { TextContent } from "../comp/core/TextContent";
import { TextField } from "../comp/core/TextField";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { ValidatedState } from "../ValidatedState";

interface LS { // Local State
    splitMode?: string;
    splitType?: string;
    delimiter?: string;
}

export class SplitNodeDlg extends DialogBase {

    delimiterState: ValidatedState<any> = new ValidatedState<any>();

    constructor(private node: J.NodeInfo, state: AppState) {
        super("Split Node", null, false, state);

        if (!this.node) {
            this.node = S.nodeUtil.getHighlightedNode(this.appState);
        }

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
            splitMode, // can be: custom | double | triple (todo-2: make an enum)
            splitType: "inline", // can be: inline | children (todo-2: make an enum)
            delimiter: "{split}"
        });
    }

    renderDlg(): CompIntf[] {
        return [
            new TextContent("Split into multiple nodes..."),

            new RadioButtonGroup([
                new RadioButton("Split Inline", false, "splitTypeGroup", null, {
                    setValue: (checked: boolean) => {
                        if (checked) {
                            this.mergeState<LS>({ splitType: "inline" });
                        }
                    },
                    getValue: (): boolean => {
                        return this.getState<LS>().splitType === "inline";
                    }
                }),
                new RadioButton("Split into Children", true, "splitTypeGroup", null, {
                    setValue: (checked: boolean) => {
                        if (checked) {
                            this.mergeState<LS>({ splitType: "children" });
                        }
                    },
                    getValue: (): boolean => {
                        return this.getState<LS>().splitType === "children";
                    }
                })
            ], "form-group-border splitNodeRadioButtonGroup"),

            new RadioButtonGroup([
                new RadioButton("Single Blank Line", true, "splitSpacingGroup", null, {
                    setValue: (checked: boolean) => {
                        if (checked) {
                            this.mergeState<LS>({ splitMode: "double" });
                        }
                    },
                    getValue: (): boolean => {
                        return this.getState<LS>().splitMode === "double";
                    }
                }),
                new RadioButton("Double Blank Line", false, "splitSpacingGroup", null, {
                    setValue: (checked: boolean) => {
                        if (checked) {
                            this.mergeState<LS>({ splitMode: "triple" });
                        }
                    },
                    getValue: (): boolean => {
                        return this.getState<LS>().splitMode === "triple";
                    }
                }),
                new RadioButton("Custom Delimiter", false, "splitSpacingGroup", null, {
                    setValue: (checked: boolean) => {
                        if (checked) {
                            this.mergeState<LS>({ splitMode: "custom" });
                        }
                    },
                    getValue: (): boolean => {
                        return this.getState<LS>().splitMode === "custom";
                    }
                })
            ], "form-group-border splitNodeRadioButtonGroup"),

            (this.getState<LS>().splitMode === "custom") ? new TextField({ label: "Delimiter", val: this.delimiterState }) : null,

            new ButtonBar([
                new Button("Split Node", this.splitNodes, null, "btn-primary"),
                new Button("Save without Splitting", this.close)
            ], "marginTop")
        ];
    }

    splitNodes = () => {
        let state = this.getState<LS>();

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

        S.edit.splitNode(this.node, state.splitType, delim, this.appState);
        this.close();
    }
}
