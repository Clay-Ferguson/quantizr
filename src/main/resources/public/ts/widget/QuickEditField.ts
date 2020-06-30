import * as J from "../JavaIntf";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Textarea } from "../widget/Textarea";
import { Span } from "./Span";
import { store, fastDispatch } from "../AppRedux";
import { AppState } from "../AppState";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class QuickEditField extends Span {

    storeKey: string;

    constructor(private node: J.NodeInfo, private isFirst: boolean, private appState: AppState) {
        super();
        this.attribs.className = "quickEditField";
        this.storeKey = this.node.id + "-" + (this.isFirst ? "1" : "0");
        this.mergeState({
            quickEditVal: "",
        });

        this.attribs.onKeyPress = (e: KeyboardEvent) => {
            if (e.which == 13) { // 13==enter key code
                if (e.shiftKey || e.ctrlKey) {
                }
                else {
                    this.onEnterKey();
                    return false;
                }
            }
        };
    }

    preRender(): void {
        let textarea = new Textarea(null, {
            rows: 5
        }, null, {
            getValue: () => {
                return this.getState().quickEditVal;
            },
            setValue: (val: any) => {
                this.mergeState({
                    quickEditVal: val
                });
            
            }
        }, "quickEditTextArea");

        this.setChildren([textarea]);
    }

    onEnterKey = () => {
        let val = this.getState().quickEditVal;

        S.util.ajax<J.InsertNodeRequest, J.InsertNodeResponse>("insertNode", {
            parentId: this.appState.node.id,
            targetOrdinal: this.node.ordinal + (this.isFirst ? 0 : 1),
            newNodeName: "",
            typeName: "u",
            initialValue: val
        }, (res) => {
            //todo-0: this timeout is required, to see the new data, and I don'w know why unless it's mongo not being able to commit fast enough ?
            setTimeout(() => {
                S.view.refreshTree(this.appState.node.id, false, res.newNode.id, false, false, false, true, this.appState);
            }, 250);
        });
    }
}
