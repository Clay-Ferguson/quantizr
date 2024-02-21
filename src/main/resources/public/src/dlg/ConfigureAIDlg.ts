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

export class ConfigureAIDlg extends DialogBase {
    static promptState: Validator = new Validator();
    static templateState: Validator = new Validator();
    static aiServiceState: Validator = new Validator("[null]");

    textScrollPos = new ScrollPos();
    queryTemplateScrollPos = new ScrollPos();

    constructor(public node: NodeInfo) {
        super("Configure AI", "appModalContMediumWidth");
        this.mergeState({}); // part of hack mentioned below (Selection state change not triggering rerender)
    }

    renderDlg(): Comp[] {
        const aiOptions = S.render.getAiOptions();
        console.log("rerendering: " + ConfigureAIDlg.aiServiceState.getValue());
        return [
            new Div(null, null, [
                new Selection(null, "AI Service", aiOptions, "aiServiceSelection", "marginBottom", ConfigureAIDlg.aiServiceState),
                new TextArea("System Prompt", {
                    rows: 7,
                    placeholder: "You are a helpful assistant."
                }, ConfigureAIDlg.promptState, null, false, 3, this.textScrollPos),
                new Span("Note: System Prompt is not yet supported for Google Gemini."),
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
    }

    save = async () => {
        // Note: The "|| [null]" makes sure the server deletes the entire property rather than leaving empty string.
        S.props.setPropVal(J.NodeProp.AI, this.node, ConfigureAIDlg.promptState.getValue() || "[null]");
        S.props.setPropVal(J.NodeProp.AI_SERVICE, this.node, ConfigureAIDlg.aiServiceState.getValue() || "[null]");
        S.props.setPropVal(J.NodeProp.AI_QUERY_TEMPLATE, this.node, ConfigureAIDlg.templateState.getValue() || "[null]");
        await S.edit.saveNode(this.node, true);
        this.close();
    }

    reset = async () => {
        debugger;
        ConfigureAIDlg.promptState.setValue("");
        ConfigureAIDlg.templateState.setValue("");
        ConfigureAIDlg.aiServiceState.setValue("[null]");

        // todo-0: we seem to have a bug where setting state on a "Selection" (like aiServiceState) above does not trigger a rerender
        // so by having this here we force a rerender of entire dialog as a workaround.
        this.mergeState({});
    }

    override async preLoad(): Promise<void> {
        await this.reload();
    }
}
