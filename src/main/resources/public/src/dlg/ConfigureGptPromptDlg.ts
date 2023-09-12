import { ScrollPos } from "../comp/base/Comp";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Diva } from "../comp/core/Diva";
import { TextArea } from "../comp/core/TextArea";
import { TextField } from "../comp/core/TextField";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { Validator } from "../Validator";
import { S } from "../Singletons";
import { Span } from "../comp/core/Span";

export class ConfigureGptPromptDlg extends DialogBase {
    modelState: Validator = new Validator();
    promptState: Validator = new Validator();
    textScrollPos = new ScrollPos();

    constructor(public node: J.NodeInfo) {
        super("Configure GPT", "appModalContMediumWidth");
    }

    renderDlg(): CompIntf[] {
        return [
            new Diva([
                new TextArea("System Prompt", {
                    rows: 15,
                    placeholder: "You are a helpful assistant."
                }, this.promptState, null, false, 3, this.textScrollPos),
                new TextField({
                    label: "ChatGPT Model",
                    val: this.modelState,
                    placeholder: "gpt-4"
                }),
                new Span("Example Models: gpt-4, gpt-3.5-turbo, etc."),
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
        this.modelState.setValue(S.props.getPropStr(J.NodeProp.AI_MODEL, this.node));
    }

    save = async () => {
        S.props.setPropVal(J.NodeProp.AI, this.node, this.promptState.getValue());
        S.props.setPropVal(J.NodeProp.AI_MODEL, this.node, this.modelState.getValue());

        await S.rpcUtil.rpc<J.SaveNodeRequest, J.SaveNodeResponse>("saveNode", {
            node: this.node,
        });
        this.close();
    }

    reset = async () => {
        this.promptState.setValue("");
        this.modelState.setValue("");
    }

    override async preLoad(): Promise<void> {
        await this.reload();
    }
}
