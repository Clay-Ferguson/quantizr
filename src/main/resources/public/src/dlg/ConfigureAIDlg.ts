import { AIService } from "../AIUtil";
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
    static foldersToExcludeState: Validator = new Validator();
    static fileExtState: Validator = new Validator("");
    static maxWordsState: Validator = new Validator();
    static temperatureState: Validator = new Validator();
    aiServiceState: Validator = new Validator("[null]");
    systemPromptScrollPos = new ScrollPos();
    foldersToIncludeScrollPos = new ScrollPos();
    foldersToExcludeScrollPos = new ScrollPos();

    constructor(public node: NodeInfo) {
        super("Configure AI Agent");
        this.aiServiceState.v.onStateChange = () => this.mergeState({});
        this.mergeState({});
    }

    renderDlg(): Comp[] {
        const aiService: AIService = S.aiUtil.getServiceByName(this.aiServiceState.getValue());
        const aiModelInfo = aiService && aiService.longDescription ? aiService.description + " -- " + aiService.longDescription : null;
        const aiOptions = S.aiUtil.getAiOptions();
        return [
            new Div(null, null, [
                new FlexLayout([
                    new Selection(null, "AI Service", aiOptions, "mb-3 mr-6", this.aiServiceState),
                ]),
                aiModelInfo ? new Div(aiModelInfo, { className: "ml-6 mb-3" }) : null,
                new TextArea("System Prompt", {
                    rows: 7,
                    placeholder: "You are a helpful assistant."
                }, ConfigureAgentDlg.promptState, null, false, 3, this.systemPromptScrollPos),
                S.quanta.config.aiAgentEnabled ? new TextArea("Folders to Include", {
                    rows: 4,
                    placeholder: "List folders to include (optional)"
                }, ConfigureAgentDlg.foldersToIncludeState, null, false, 3, this.foldersToIncludeScrollPos) : null,
                S.quanta.config.aiAgentEnabled ? new TextArea("Folders to Exclude", {
                    rows: 4,
                    placeholder: "List folders to exclude (optional)"
                }, ConfigureAgentDlg.foldersToExcludeState, null, false, 3, this.foldersToExcludeScrollPos) : null, //
                S.quanta.config.aiAgentEnabled ? new TextField({
                    label: "File Extensions (ex: java,py,txt)",
                    val: ConfigureAgentDlg.fileExtState,
                    outterClass: "mt-3"
                }) : null,
                new FlexLayout([
                    new TextField({
                        label: "Max Response Words",
                        val: ConfigureAgentDlg.maxWordsState,
                        inputClass: "maxResponseWords",
                        outterClass: "mt-3"
                    }),
                    new TextField({
                        label: "Creativity (0.0-1.0, Default=0.7)",
                        val: ConfigureAgentDlg.temperatureState,
                        inputClass: "aiTemperature",
                        outterClass: "ml-3 mt-3"
                    }),
                ]),
                new ButtonBar([
                    new Button("Save", this.save, null, "-primary"),
                    new Button("Reset", this.reset, null, "-secondary"),
                    new Button("Cancel", this._close, null, "-secondary float-right")
                ], "mt-3")
            ])
        ];
    }

    reload = async () => {
        ConfigureAgentDlg.promptState.setValue(S.props.getPropStr(J.NodeProp.AI_PROMPT, this.node));
        ConfigureAgentDlg.foldersToIncludeState.setValue(S.props.getPropStr(J.NodeProp.AI_FOLDERS_TO_INCLUDE, this.node));
        ConfigureAgentDlg.foldersToExcludeState.setValue(S.props.getPropStr(J.NodeProp.AI_FOLDERS_TO_EXCLUDE, this.node));
        ConfigureAgentDlg.fileExtState.setValue(S.props.getPropStr(J.NodeProp.AI_FILE_EXTENSIONS, this.node));
        ConfigureAgentDlg.maxWordsState.setValue(S.props.getPropStr(J.NodeProp.AI_MAX_WORDS, this.node));
        ConfigureAgentDlg.temperatureState.setValue(S.props.getPropStr(J.NodeProp.AI_TEMPERATURE, this.node));
        this.aiServiceState.setValue(S.props.getPropStr(J.NodeProp.AI_SERVICE, this.node) || "[null]");
    }

    save = async () => {
        // Note: The "|| [null]" makes sure the server deletes the entire property rather than leaving empty string.
        S.props.setPropVal(J.NodeProp.AI_PROMPT, this.node, ConfigureAgentDlg.promptState.getValue() || "[null]");
        S.props.setPropVal(J.NodeProp.AI_FOLDERS_TO_INCLUDE, this.node, ConfigureAgentDlg.foldersToIncludeState.getValue() || "[null]");
        S.props.setPropVal(J.NodeProp.AI_FOLDERS_TO_EXCLUDE, this.node, ConfigureAgentDlg.foldersToExcludeState.getValue() || "[null]");
        S.props.setPropVal(J.NodeProp.AI_FILE_EXTENSIONS, this.node, ConfigureAgentDlg.fileExtState.getValue() || "[null]");
        S.props.setPropVal(J.NodeProp.AI_SERVICE, this.node, this.aiServiceState.getValue() || "[null]");
        S.props.setPropVal(J.NodeProp.AI_MAX_WORDS, this.node, ConfigureAgentDlg.maxWordsState.getValue() || "[null]");
        S.props.setPropVal(J.NodeProp.AI_TEMPERATURE, this.node, ConfigureAgentDlg.temperatureState.getValue() || "[null]");

        const aiService: AIService = S.aiUtil.getServiceByName(this.aiServiceState.getValue());
        if (aiService && aiService.name !== J.AIModel.NONE) {
            S.props.setPropVal(J.NodeProp.AI_AGENT, this.node, "true");
        }
        else {
            S.props.setPropVal(J.NodeProp.AI_AGENT, this.node, "[null]");
        }

        await S.edit.saveNode(this.node, true);
        this.close();
    }

    reset = async () => {
        ConfigureAgentDlg.promptState.setValue("");
        ConfigureAgentDlg.foldersToIncludeState.setValue("");
        ConfigureAgentDlg.foldersToExcludeState.setValue("");
        ConfigureAgentDlg.fileExtState.setValue("");
        ConfigureAgentDlg.maxWordsState.setValue("");
        ConfigureAgentDlg.temperatureState.setValue("");
        this.aiServiceState.setValue("[null]");
    }

    override async preLoad(): Promise<void> {
        await this.reload();
    }
}
