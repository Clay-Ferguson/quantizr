import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { NodeInfo } from "../JavaIntf";
import { S } from "../Singletons";
import { Validator } from "../Validator";
import { Comp, ScrollPos } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { Span } from "../comp/core/Span";
import { TextArea } from "../comp/core/TextArea";
import { Selection } from "../comp/core/Selection";

export class ConfigureAIPromptDlg extends DialogBase {
    promptState: Validator = new Validator();
    templateState: Validator = new Validator();
    aiServiceState: Validator = new Validator(J.AIServiceName.OPENAI);
    textScrollPos = new ScrollPos();
    queryTemplateScrollPos = new ScrollPos();

    constructor(public node: NodeInfo) {
        super("Configure AI", "appModalContMediumWidth");
    }

    renderDlg(): Comp[] {
        const aiOptions = S.render.getAiOptions();
        return [
            new Div(null, null, [
                new Selection(null, "AI Service", aiOptions, "aiServiceSelection", "marginBottom", {
                    setValue: (val: string) => this.aiServiceState.setValue(val),
                    getValue: (): string => "" + this.aiServiceState.getValue()
                }),
                new TextArea("System Prompt", {
                    rows: 7,
                    placeholder: "You are a helpful assistant."
                }, this.promptState, null, false, 3, this.textScrollPos),
                new Span("Note: System Prompt is not yet supported for Google Gemini."),
                new TextArea("Query Template", {
                    rows: 7,
                    placeholder: "${content}"
                }, this.templateState, null, false, 3, this.queryTemplateScrollPos),
                new ButtonBar([
                    new Button("Save", this.save, null, "btn-primary"),
                    new Button("Reset", this.reset, null, "btn-secondary"),
                    new Button("Cancel", this.close, null, "btn-secondary float-end")
                ], "marginTop")
            ])
        ];
    }

    reload = async () => {
        this.promptState.setValue(S.props.getPropStr(J.NodeProp.AI, this.node));
        this.templateState.setValue(S.props.getPropStr(J.NodeProp.AI_QUERY_TEMPLATE, this.node));
        this.aiServiceState.setValue(S.props.getPropStr(J.NodeProp.AI_SERVICE, this.node));
    }

    save = async () => {
        const template = this.templateState.getValue();
        if (template && !template.includes("${content}")) {
            this.templateState.setError("Query Template must contain ${content}, if not left blank.");
            return;
        }

        S.props.setPropVal(J.NodeProp.AI, this.node, this.promptState.getValue());
        S.props.setPropVal(J.NodeProp.AI_SERVICE, this.node, this.aiServiceState.getValue());
        S.props.setPropVal(J.NodeProp.AI_QUERY_TEMPLATE, this.node, this.templateState.getValue());

        await S.rpcUtil.rpc<J.SaveNodeRequest, J.SaveNodeResponse>("saveNode", {
            node: this.node,
            returnInlineChildren: false
        });
        this.close();
    }

    reset = async () => {
        this.promptState.setValue("");
        this.templateState.setValue("");
    }

    override async preLoad(): Promise<void> {
        await this.reload();
    }
}
