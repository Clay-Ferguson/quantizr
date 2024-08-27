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

export class ConfigureAgentDlg extends DialogBase {
    static promptState: Validator = new Validator();
    static foldersToIncludeState: Validator = new Validator();
    static fileExtState: Validator = new Validator("");
    static maxWordsState: Validator = new Validator();
    static temperatureState: Validator = new Validator();
    static aiServiceState: Validator = new Validator("[null]");
    systemPromptScrollPos = new ScrollPos();
    foldersToIncludeScrollPos = new ScrollPos();

    constructor(public node: NodeInfo) {
        super("Configure AI Agent");
    }

    renderDlg(): Comp[] {
        const aiOptions = S.aiUtil.getAiOptions();
        return [
            new Div(null, null, [
                new FlexLayout([
                    new Selection(null, "AI Service", aiOptions, "aiServiceSelection", "marginBottom bigMarginRight", ConfigureAgentDlg.aiServiceState),
                ]),
                new TextArea("System Prompt", {
                    rows: 7,
                    placeholder: "You are a helpful assistant."
                }, ConfigureAgentDlg.promptState, null, false, 3, this.systemPromptScrollPos),
                S.quanta.config.aiAgentEnabled ? new TextArea("Folders to Include", {
                    rows: 4,
                    placeholder: "List folders to include (optional)"
                }, ConfigureAgentDlg.foldersToIncludeState, null, false, 3, this.foldersToIncludeScrollPos) : null,
                S.quanta.config.aiAgentEnabled ? new TextField({ label: "File Extensions (ex: java,py,txt)", val: ConfigureAgentDlg.fileExtState }) : null,
                new FlexLayout([
                    new TextField({
                        label: "Max Response Words",
                        val: ConfigureAgentDlg.maxWordsState,
                        inputClass: "maxResponseWords",
                    }),
                    new TextField({
                        label: "Creativity (0.0-1.0, Default=0.7)",
                        val: ConfigureAgentDlg.temperatureState,
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
        ConfigureAgentDlg.promptState.setValue(S.props.getPropStr(J.NodeProp.AI_PROMPT, this.node));
        ConfigureAgentDlg.foldersToIncludeState.setValue(S.props.getPropStr(J.NodeProp.AI_FOLDERS_TO_INCLUDE, this.node));
        ConfigureAgentDlg.fileExtState.setValue(S.props.getPropStr(J.NodeProp.AI_FILE_EXTENSIONS, this.node));
        ConfigureAgentDlg.maxWordsState.setValue(S.props.getPropStr(J.NodeProp.AI_MAX_WORDS, this.node));
        ConfigureAgentDlg.temperatureState.setValue(S.props.getPropStr(J.NodeProp.AI_TEMPERATURE, this.node));
        ConfigureAgentDlg.aiServiceState.setValue(S.props.getPropStr(J.NodeProp.AI_SERVICE, this.node) || "[null]");
    }

    save = async () => {
        // Note: The "|| [null]" makes sure the server deletes the entire property rather than leaving empty string.
        S.props.setPropVal(J.NodeProp.AI_PROMPT, this.node, ConfigureAgentDlg.promptState.getValue() || "[null]");
        S.props.setPropVal(J.NodeProp.AI_FOLDERS_TO_INCLUDE, this.node, ConfigureAgentDlg.foldersToIncludeState.getValue() || "[null]");
        S.props.setPropVal(J.NodeProp.AI_FILE_EXTENSIONS, this.node, ConfigureAgentDlg.fileExtState.getValue() || "[null]");
        S.props.setPropVal(J.NodeProp.AI_SERVICE, this.node, ConfigureAgentDlg.aiServiceState.getValue() || "[null]");
        S.props.setPropVal(J.NodeProp.AI_MAX_WORDS, this.node, ConfigureAgentDlg.maxWordsState.getValue() || "[null]");
        S.props.setPropVal(J.NodeProp.AI_TEMPERATURE, this.node, ConfigureAgentDlg.temperatureState.getValue() || "[null]");

        await S.edit.saveNode(this.node, true);
        this.close();
    }

    reset = async () => {
        ConfigureAgentDlg.promptState.setValue("");
        ConfigureAgentDlg.foldersToIncludeState.setValue("");
        ConfigureAgentDlg.fileExtState.setValue("");
        ConfigureAgentDlg.maxWordsState.setValue("");
        ConfigureAgentDlg.temperatureState.setValue("");
        ConfigureAgentDlg.aiServiceState.setValue("[null]");
    }

    override async preLoad(): Promise<void> {
        await this.reload();
    }
}
