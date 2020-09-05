import { dispatch } from "../AppRedux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { SplitNodeDlg } from "../dlg/SplitNodeDlg";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Button } from "./Button";
import { ButtonBar } from "./ButtonBar";
import { Div } from "./Div";
import { Span } from "./Span";
import { Textarea } from "./Textarea";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class InlineEditField extends Span {

    constructor(private node: J.NodeInfo, private appState: AppState) {
        super();
        this.attribs.className = "col-9 quickEditSpan ";

        //todo-1: this is not the final plae to hold state for this maybe?
        this.mergeState({
            inlineEditVal: appState.inlineEditVal
        });

        this.saveEdit = this.saveEdit.bind(this);
        this.cancelEdit = this.cancelEdit.bind(this);
    }

    preRender(): void {
        let state = this.getState();

        let textarea = new Textarea(null, {
            rows: 10,
        }, {
            getValue: () => {
                return this.getState().inlineEditVal;
            },
            setValue: (val: any) => {
                this.mergeState({
                    inlineEditVal: val
                });
            }
        }, "form-control pre-textarea quickEditTextArea");

        let buttonBar = new ButtonBar([
            new Button("Save", this.saveEdit, null, "btn-primary"),
            new Button("Cancel", this.cancelEdit)
        ], null, "marginTop");

        let editContainer = new Div(null, {
            className: "inlineEditFormArea"
        }, [textarea, buttonBar]);

        textarea.focus();

        this.setChildren([editContainer]);
    }

    saveEdit(): void {
        dispatch({
            type: "Action_InlineEdit",
            update: (s: AppState): void => {
                s.inlineEditId = null;
                this.node.content = this.getState().inlineEditVal;
                let askToSplit = this.node.content && (this.node.content.indexOf("{split}") != -1 ||
                    this.node.content.indexOf("\n\n\n") != -1);

                S.util.ajax<J.SaveNodeRequest, J.SaveNodeResponse>("saveNode", {
                    updateModTime: true,
                    node: this.node
                }, async (res: J.SaveNodeResponse) => {
                    await S.edit.updateIpfsNodeJson(this.node, this.appState);
                    S.edit.saveNodeResponse(this.node, res, false, this.appState);

                    if (askToSplit) {
                        new SplitNodeDlg(this.node, this.appState).open();
                    }
                });
            }
        });
    }

    cancelEdit(): void {
        dispatch({
            type: "Action_InlineEdit",
            update: (s: AppState): void => {
                s.inlineEditId = null;
            }
        });
    }
}
