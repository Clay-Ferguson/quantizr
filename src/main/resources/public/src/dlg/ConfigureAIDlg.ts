import { AIService } from "../AIUtil";
import { dispatch, getAs } from "../AppContext";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { NodeInfo } from "../JavaIntf";
import { S } from "../Singletons";
import { Validator } from "../Validator";
import { Comp, ScrollPos } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { CollapsiblePanel } from "../comp/core/CollapsiblePanel";
import { Div } from "../comp/core/Div";
import { FlexLayout } from "../comp/core/FlexLayout";
import { Selection } from "../comp/core/Selection";
import { TextArea } from "../comp/core/TextArea";
import { TextField } from "../comp/core/TextField";

export class ConfigureAgentDlg extends DialogBase {
    promptState: Validator = new Validator();
    foldersToIncludeState: Validator = new Validator();
    foldersToExcludeState: Validator = new Validator();
    fileExtState: Validator = new Validator("");
    maxWordsState: Validator = new Validator();
    temperatureState: Validator = new Validator();
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
                }, this.promptState, null, false, 3, this.systemPromptScrollPos),
                S.quanta.config.aiAgentEnabled ? new CollapsiblePanel("Coding Agent Props", "Hide Coding Agent Props", null, [
                    new TextArea("Folders to Include", {
                        rows: 4,
                        placeholder: "List folders to include (optional)"
                    }, this.foldersToIncludeState, null, false, 3, this.foldersToIncludeScrollPos, "mt-3"),
                    new TextArea("Folders to Exclude", {
                        rows: 4,
                        placeholder: "List folders to exclude (optional)"
                    }, this.foldersToExcludeState, null, false, 3, this.foldersToExcludeScrollPos, "mt-3"), //
                    new TextField({
                        label: "File Extensions (ex: java,py,txt)",
                        val: this.fileExtState,
                        outterClass: "mt-3"
                    }),
                ], true,
                    (expanded: boolean) => {
                        dispatch("setPropsPanelExpanded", s => {
                            s.agentPropsExpanded = expanded;
                        });
                    }, getAs().agentPropsExpanded, "", "", null, "div") : null,
                new FlexLayout([
                    new TextField({
                        label: "Max Response Words",
                        val: this.maxWordsState,
                        inputClass: "maxResponseWords",
                        outterClass: "mt-3"
                    }),
                    new TextField({
                        label: "Creativity (0.0-1.0, Default=0.7)",
                        val: this.temperatureState,
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
        this.promptState.setValue(S.props.getPropStr(J.NodeProp.AI_PROMPT, this.node));
        this.foldersToIncludeState.setValue(S.props.getPropStr(J.NodeProp.AI_FOLDERS_TO_INCLUDE, this.node));
        this.foldersToExcludeState.setValue(S.props.getPropStr(J.NodeProp.AI_FOLDERS_TO_EXCLUDE, this.node));
        this.fileExtState.setValue(S.props.getPropStr(J.NodeProp.AI_FILE_EXTENSIONS, this.node));
        this.maxWordsState.setValue(S.props.getPropStr(J.NodeProp.AI_MAX_WORDS, this.node));
        this.temperatureState.setValue(S.props.getPropStr(J.NodeProp.AI_TEMPERATURE, this.node));
        this.aiServiceState.setValue(S.props.getPropStr(J.NodeProp.AI_SERVICE, this.node) || "[null]");
    }

    save = async () => {
        // Note: The "|| [null]" makes sure the server deletes the entire property rather than leaving empty string.
        S.props.setPropVal(J.NodeProp.AI_PROMPT, this.node, this.promptState.getValue() || "[null]");
        S.props.setPropVal(J.NodeProp.AI_FOLDERS_TO_INCLUDE, this.node, this.foldersToIncludeState.getValue() || "[null]");
        S.props.setPropVal(J.NodeProp.AI_FOLDERS_TO_EXCLUDE, this.node, this.foldersToExcludeState.getValue() || "[null]");
        S.props.setPropVal(J.NodeProp.AI_FILE_EXTENSIONS, this.node, this.fileExtState.getValue() || "[null]");
        S.props.setPropVal(J.NodeProp.AI_SERVICE, this.node, this.aiServiceState.getValue() || "[null]");
        S.props.setPropVal(J.NodeProp.AI_MAX_WORDS, this.node, this.maxWordsState.getValue() || "[null]");
        S.props.setPropVal(J.NodeProp.AI_TEMPERATURE, this.node, this.temperatureState.getValue() || "[null]");

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
        this.promptState.setValue("");
        this.foldersToIncludeState.setValue("");
        this.foldersToExcludeState.setValue("");
        this.fileExtState.setValue("");
        this.maxWordsState.setValue("");
        this.temperatureState.setValue("");
        this.aiServiceState.setValue("[null]");
    }

    override async preLoad(): Promise<void> {
        await this.reload();
    }
}
