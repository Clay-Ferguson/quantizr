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

export class ConfigureGptPromptDlg extends DialogBase {
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
                new Span("Note: System Prompt is not yet supported for Google Gemini."),
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
    }

    save = async () => {
        S.props.setPropVal(J.NodeProp.AI, this.node, this.promptState.getValue());

        await S.rpcUtil.rpc<J.SaveNodeRequest, J.SaveNodeResponse>("saveNode", {
            node: this.node,
            returnInlineChildren: false
        });
        this.close();
    }

    reset = async () => {
        this.promptState.setValue("");
    }

    override async preLoad(): Promise<void> {
        await this.reload();
    }
}
