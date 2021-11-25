import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { ValidatedState } from "../ValidatedState";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { RadioButton } from "../widget/RadioButton";
import { RadioButtonGroup } from "../widget/RadioButtonGroup";
import { TextContent } from "../widget/TextContent";
import { TextField } from "../widget/TextField";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class SplitNodeDlg extends DialogBase {

    delimiterState: ValidatedState<any> = new ValidatedState<any>();

    constructor(private node: J.NodeInfo, state: AppState) {
        super("Split Node", null, false, state);

        if (!this.node) {
            this.node = S.quanta.getHighlightedNode(this.appState);
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

        this.mergeState({
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
                    setValue: (checked: boolean): void => {
                        if (checked) {
                            this.mergeState({ splitType: "inline" });
                        }
                    },
                    getValue: (): boolean => {
                        return this.getState().splitType === "inline";
                    }
                }),
                new RadioButton("Split into Children", true, "splitTypeGroup", null, {
                    setValue: (checked: boolean): void => {
                        if (checked) {
                            this.mergeState({ splitType: "children" });
                        }
                    },
                    getValue: (): boolean => {
                        return this.getState().splitType === "children";
                    }
                })
            ], "form-group-border splitNodeRadioButtonGroup"),

            new RadioButtonGroup([
                new RadioButton("Single Blank Line", true, "splitSpacingGroup", null, {
                    setValue: (checked: boolean): void => {
                        if (checked) {
                            this.mergeState({ splitMode: "double" });
                        }
                    },
                    getValue: (): boolean => {
                        return this.getState().splitMode === "double";
                    }
                }),
                new RadioButton("Double Blank Line", false, "splitSpacingGroup", null, {
                    setValue: (checked: boolean): void => {
                        if (checked) {
                            this.mergeState({ splitMode: "triple" });
                        }
                    },
                    getValue: (): boolean => {
                        return this.getState().splitMode === "triple";
                    }
                }),
                new RadioButton("Custom Delimiter", false, "splitSpacingGroup", null, {
                    setValue: (checked: boolean): void => {
                        if (checked) {
                            this.mergeState({ splitMode: "custom" });
                        }
                    },
                    getValue: (): boolean => {
                        return this.getState().splitMode === "custom";
                    }
                })
            ], "form-group-border splitNodeRadioButtonGroup"),

            (this.getState().splitMode === "custom") ? new TextField("Delimiter", false, null, null, false, this.delimiterState) : null,

            new ButtonBar([
                new Button("Split Node", this.splitNodes, null, "btn-primary"),
                new Button("Save without Splitting", this.close)
            ], "marginTop")
        ];
    }

    splitNodes = (): void => {
        let state = this.getState();

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
