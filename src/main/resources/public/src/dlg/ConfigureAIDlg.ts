import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { NodeInfo } from "../JavaIntf";
import { S } from "../Singletons";
import { Validator } from "../Validator";
import { Comp, ScrollPos } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { FlexLayout } from "../comp/core/FlexLayout";
import { Selection } from "../comp/core/Selection";
import { TextArea } from "../comp/core/TextArea";
import { TextField } from "../comp/core/TextField";

export class ConfigureAIDlg extends DialogBase {
    static promptState: Validator = new Validator();
    static maxWordsState: Validator = new Validator();
    static temperatureState: Validator = new Validator();
    static aiServiceState: Validator = new Validator("[null]");
    textScrollPos = new ScrollPos();

    constructor(public node: NodeInfo) {
        super("Configure AI");
    }

    renderDlg(): Comp[] {
        const aiOptions = S.aiUtil.getAiOptions();
        return [
            new Div(null, null, [
                new FlexLayout([
                    new Selection(null, "AI Service", aiOptions, "aiServiceSelection", "marginBottom bigMarginRight", ConfigureAIDlg.aiServiceState),
                ]),
                new TextArea("System Prompt", {
                    rows: 7,
                    placeholder: "You are a helpful assistant."
                }, ConfigureAIDlg.promptState, null, false, 3, this.textScrollPos),
                new FlexLayout([
                    new TextField({
                        label: "Max Response Words",
                        val: ConfigureAIDlg.maxWordsState,
                        inputClass: "maxResponseWords",
                    }),
                    new TextField({
                        label: "Creativity (0.0-1.0, Default=0.7)",
                        val: ConfigureAIDlg.temperatureState,
                        inputClass: "aiTemperature",
                        outterClass: "marginLeft"
                    }),
                ]),
                new ButtonBar([
                    new Button("Save", this.save, null, "btn-primary"),
                    new Button("Reset", this.reset, null, "btn-secondary"),
                    new Button("Cancel", this.close, null, "btn-secondary float-end")
                ], "marginTop")
            ])
        ];
    }

    reload = async () => {
        ConfigureAIDlg.promptState.setValue(S.props.getPropStr(J.NodeProp.AI_PROMPT, this.node));
        ConfigureAIDlg.maxWordsState.setValue(S.props.getPropStr(J.NodeProp.AI_MAX_WORDS, this.node));
        ConfigureAIDlg.temperatureState.setValue(S.props.getPropStr(J.NodeProp.AI_TEMPERATURE, this.node));
        ConfigureAIDlg.aiServiceState.setValue(S.props.getPropStr(J.NodeProp.AI_SERVICE, this.node) || "[null]");
    }

    save = async () => {
        // Note: The "|| [null]" makes sure the server deletes the entire property rather than leaving empty string.
        S.props.setPropVal(J.NodeProp.AI_PROMPT, this.node, ConfigureAIDlg.promptState.getValue() || "[null]");
        S.props.setPropVal(J.NodeProp.AI_SERVICE, this.node, ConfigureAIDlg.aiServiceState.getValue() || "[null]");
        S.props.setPropVal(J.NodeProp.AI_MAX_WORDS, this.node, ConfigureAIDlg.maxWordsState.getValue() || "[null]");
        S.props.setPropVal(J.NodeProp.AI_TEMPERATURE, this.node, ConfigureAIDlg.temperatureState.getValue() || "[null]");

        await S.edit.saveNode(this.node, true);
        this.close();
    }

    reset = async () => {
        ConfigureAIDlg.promptState.setValue("");
        ConfigureAIDlg.maxWordsState.setValue("");
        ConfigureAIDlg.temperatureState.setValue("");
        ConfigureAIDlg.aiServiceState.setValue("[null]");
    }

    override async preLoad(): Promise<void> {
        await this.reload();
    }
}
