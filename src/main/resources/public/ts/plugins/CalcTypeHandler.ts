import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { NodeActionType } from "../enums/NodeActionType";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "../widget/base/Comp";
import { Div } from "../widget/Div";
import { Pre } from "../widget/Pre";
import { TypeBase } from "./base/TypeBase";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

let win: any = window;

export class CalcTypeHandler extends TypeBase {

    constructor() {
        super(J.NodeType.CALCULATOR, "Calculator", "fa-calculator", true);
    }

    getEditorHelp(): string {
        return S.quanta?.config?.help?.type?.calculator?.editor;
    }

    allowAction(action: NodeActionType, node: J.NodeInfo, appState: AppState): boolean {
        return true;
    }

    getAllowContentEdit(): boolean {
        return true;
    }

    render(node: J.NodeInfo, rowStyling: boolean, isTreeView: boolean, state: AppState): Comp {
        if (!S.props.isMine(node, state)) {
            return new Div("Only the Owner of a Calculation node can run the calculation.");
        }

        // scripts are recommended to put all variables in 'window.qc' to be safest
        win.qc = {
            logs: [],
            log: (v: any) => {
                win.qc.logs.push(v);
            },
            formatCurrency: S.util.formatCurrency
        };

        try {
            win.eval(node.content);
            return new Pre(win.qc.logs.join("\n"), { className: "calcOutputArea" });
        }
        catch (e) {
            return new Pre(e.message + "\n" + e.stack, { className: "calcOutputArea" });
        }
        finally {
            win.qc = null;
        }
    }

    ensureDefaultProperties(node: J.NodeInfo) {
        // this has the unintended behavior of when the user tries to clear out the text it comes back in realtime.
        // if (!node.content) {
        //     node.content = "qc.a=23;\nqc.b=19;\n\nqc.log('Answer=' + (qc.a + qc.b));";
        // }
    }
}
