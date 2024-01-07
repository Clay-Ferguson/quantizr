import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { NodeInfo } from "../JavaIntf";
import { S } from "../Singletons";
import { Validator } from "../Validator";
import { Comp, ScrollPos } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { TextArea } from "../comp/core/TextArea";

export class ConfigureGptPromptDlg extends DialogBase {
    modelState: Validator = new Validator();
    promptState: Validator = new Validator();
    textScrollPos = new ScrollPos();

    constructor(public node: NodeInfo) {
        super("Configure GPT", "appModalContMediumWidth");
    }

    renderDlg(): Comp[] {
        return [
            new Div(null, null, [
                new TextArea("System Prompt", {
                    rows: 15,
                    placeholder: "You are a helpful assistant."
                }, this.promptState, null, false, 3, this.textScrollPos),
                // new TextField({
                //     label: "ChatGPT Model",
                //     val: this.modelState,
                //     placeholder: "gpt-4"
                // }),
                // new Span("Example Models: gpt-4, gpt-3.5-turbo, etc."),
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
            returnInlineChildren: false
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
