import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { NodeInfo } from "../JavaIntf";
import { S } from "../Singletons";
import { Validator } from "../Validator";
import { Comp, ScrollPos } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Checkbox } from "../comp/core/Checkbox";
import { Div } from "../comp/core/Div";
import { FlexLayout } from "../comp/core/FlexLayout";
import { Selection } from "../comp/core/Selection";
import { TextArea } from "../comp/core/TextArea";

export class ConfigureAIDlg extends DialogBase {
    static promptState: Validator = new Validator();
    static templateState: Validator = new Validator();
    static aiServiceState: Validator = new Validator("[null]");
    static overwriteState: Validator = new Validator(false);

    textScrollPos = new ScrollPos();
    queryTemplateScrollPos = new ScrollPos();

    constructor(public node: NodeInfo) {
        super("Configure AI", "appModalContMediumWidth");
    }

    renderDlg(): Comp[] {
        const aiOptions = S.aiUtil.getAiOptions();
        console.log("rerendering: " + ConfigureAIDlg.aiServiceState.getValue());
        return [
            new Div(null, null, [
                new FlexLayout([
                    new Selection(null, "AI Service", aiOptions, "aiServiceSelection", "marginBottom bigMarginRight", ConfigureAIDlg.aiServiceState),
                    new Checkbox("Overwrite Content with Answer", null, ConfigureAIDlg.overwriteState)
                ]),
                new TextArea("System Prompt", {
                    rows: 7,
                    placeholder: "You are a helpful assistant."
                }, ConfigureAIDlg.promptState, null, false, 3, this.textScrollPos),
                new Div("Note 1: System Prompt is not yet supported for Google Gemini."),
                new Div("Note 2: For Anthropic's Claude AI, the System Prompt is used only as a prompt prefix."),
                new TextArea("Query Template", {
                    rows: 7,
                    placeholder: "${content}"
                }, ConfigureAIDlg.templateState, null, false, 3, this.queryTemplateScrollPos),
                new ButtonBar([
                    new Button("Save", this.save, null, "btn-primary"),
                    new Button("Reset", this.reset, null, "btn-secondary"),
                    new Button("Cancel", this.close, null, "btn-secondary float-end")
                ], "marginTop")
            ])
        ];
    }

    reload = async () => {
        ConfigureAIDlg.promptState.setValue(S.props.getPropStr(J.NodeProp.AI, this.node));
        ConfigureAIDlg.templateState.setValue(S.props.getPropStr(J.NodeProp.AI_QUERY_TEMPLATE, this.node));
        ConfigureAIDlg.aiServiceState.setValue(S.props.getPropStr(J.NodeProp.AI_SERVICE, this.node) || "[null]");
        ConfigureAIDlg.overwriteState.setValue(!!S.props.getPropStr(J.NodeProp.AI_OVERWRITE, this.node));
    }

    save = async () => {
        const template = ConfigureAIDlg.templateState.getValue();
        if (template?.includes("${content}") && !!ConfigureAIDlg.overwriteState.getValue()) {
            ConfigureAIDlg.templateState.setError("Template cannot contain ${content} when Overwrite is enabled.");
            return;
        }

        // Note: The "|| [null]" makes sure the server deletes the entire property rather than leaving empty string.
        S.props.setPropVal(J.NodeProp.AI, this.node, ConfigureAIDlg.promptState.getValue() || "[null]");
        S.props.setPropVal(J.NodeProp.AI_SERVICE, this.node, ConfigureAIDlg.aiServiceState.getValue() || "[null]");
        S.props.setPropVal(J.NodeProp.AI_QUERY_TEMPLATE, this.node, ConfigureAIDlg.templateState.getValue() || "[null]");
        S.props.setPropVal(J.NodeProp.AI_OVERWRITE, this.node, !!ConfigureAIDlg.overwriteState.getValue() || "[null]");
        await S.edit.saveNode(this.node, true);
        this.close();
    }

    reset = async () => {
        ConfigureAIDlg.promptState.setValue("");
        ConfigureAIDlg.templateState.setValue("");
        ConfigureAIDlg.aiServiceState.setValue("[null]");
        ConfigureAIDlg.overwriteState.setValue(false);
    }

    override async preLoad(): Promise<void> {
        await this.reload();
    }
}
