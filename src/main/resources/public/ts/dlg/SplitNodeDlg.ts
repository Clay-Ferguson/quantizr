import * as J from "../JavaIntf";
import { DialogBase } from "../DialogBase";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { RadioButton } from "../widget/RadioButton";
import { RadioButtonGroup } from "../widget/RadioButtonGroup";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { TextField } from "../widget/TextField";
import { TextContent } from "../widget/TextContent";
import { AppState } from "../AppState";
import { CompIntf } from "../widget/base/CompIntf";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class SplitNodeDlg extends DialogBase {

    constructor(private node: J.NodeInfo, state: AppState) {
        super("Split Node", null, false, state);

        if (!this.node) {
            this.node = S.meta64.getHighlightedNode(this.appState);
        }

        let splitMode;
        if (this.node.content.indexOf("\n\n\n") != -1) {
            splitMode = "triple"
        }
        else if (this.node.content.indexOf("\n\n") != -1) {
            splitMode = "double"
        }
        else {
            splitMode = "custom"
        }

        this.mergeState({
            splitMode, //can be: custom | double | triple (todo-1: make an enum)
            splitType: "inline", //can be: inline | children (todo-1: make an enum)
            delimiter: "{split}"
        });
    }

    renderDlg(): CompIntf[] {
        let children = [
            new TextContent("Split into multiple nodes..."),

            new RadioButtonGroup([
                new RadioButton("Split Inline", false, "splitTypeGroup", null, {
                    setValue: (checked: boolean): void => {
                        if (checked) {
                            this.mergeState({ splitType: "inline" });
                        }
                    },
                    getValue: (): boolean => {
                        return this.getState().splitType == "inline";
                    }
                }),
                new RadioButton("Split into Children", true, "splitTypeGroup", null, {
                    setValue: (checked: boolean): void => {
                        if (checked) {
                            this.mergeState({ splitType: "children" });
                        }
                    },
                    getValue: (): boolean => {
                        return this.getState().splitType == "children";
                    }
                })
            ], "form-group-border marginBottom"),

            new RadioButtonGroup([
                new RadioButton("Double Spaced", true, "splitSpacingGroup", null, {
                    setValue: (checked: boolean): void => {
                        if (checked) {
                            this.mergeState({ splitMode: "double" });
                        }
                    },
                    getValue: (): boolean => {
                        return this.getState().splitMode == "double";
                    }
                }),
                new RadioButton("Triple Spaced", false, "splitSpacingGroup", null, {
                    setValue: (checked: boolean): void => {
                        if (checked) {
                            this.mergeState({ splitMode: "triple" });
                        }
                    },
                    getValue: (): boolean => {
                        return this.getState().splitMode == "triple";
                    }
                }),
                new RadioButton("Custom Delimiter", false, "splitSpacingGroup", null, {
                    setValue: (checked: boolean): void => {
                        if (checked) {
                            this.mergeState({ splitMode: "custom" });
                        }
                    },
                    getValue: (): boolean => {
                        return this.getState().splitMode == "custom";
                    }
                }),
            ], "form-group-border marginBottom"),

            (this.getState().splitMode == "custom") ? new TextField("Delimiter", null, false, null, {
                getValue: (): string => {
                    return this.getState().delimiter;
                },
                setValue: (val: string): void => {
                    this.mergeState({ delimiter: val });
                }
            }) : null,

            new ButtonBar([
                new Button("Split Node", this.splitNodes, null, "btn-primary"),
                new Button("Cancel", () => {
                    this.close();
                })
            ])
        ];

        return children;
    }

    renderButtons(): CompIntf {
        return null;
    }

    splitNodes = (): void => {
        let state = this.getState();

        let delim = "";
        if (state.splitMode == "double") {
            delim = "\n\n";
        }
        else if (state.splitMode == "triple") {
            delim = "\n\n\n";
        }
        else if (state.splitMode == "custom") {
            delim = state.delimiter;
        }

        S.edit.splitNode(this.node, state.splitType, delim, this.appState)
        this.close();
    }
}
