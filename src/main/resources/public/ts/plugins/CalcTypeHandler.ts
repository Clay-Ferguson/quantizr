import { getAppState } from "../AppRedux";
import { AppState } from "../AppState";
import { Comp } from "../comp/base/Comp";
import { Div } from "../comp/core/Div";
import { Pre } from "../comp/core/Pre";
import { NodeActionType } from "../enums/NodeActionType";
import { TabIntf } from "../intf/TabIntf";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { TypeBase } from "./base/TypeBase";

let win: any = window;

export class CalcTypeHandler extends TypeBase {

    constructor() {
        // false=disabling user's ability to select
        super(J.NodeType.CALCULATOR, "Calculator", "fa-calculator", false);
    }

    getEditorHelp(): string {
        let state = getAppState();
        return state.config?.help?.type?.calculator?.editor;
    }

    allowAction(action: NodeActionType, node: J.NodeInfo, appState: AppState): boolean {
        return true;
    }

    getAllowContentEdit(): boolean {
        return true;
    }

    render = (node: J.NodeInfo, tabData: TabIntf<any>, rowStyling: boolean, isTreeView: boolean, state: AppState): Comp => {
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
