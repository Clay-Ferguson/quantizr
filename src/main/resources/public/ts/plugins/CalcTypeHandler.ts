import { getAppState } from "../AppContext";
import { AppState } from "../AppState";
import { Comp } from "../comp/base/Comp";
import { Div } from "../comp/core/Div";
import { Pre } from "../comp/core/Pre";
import { TabIntf } from "../intf/TabIntf";
import { NodeActionType } from "../intf/TypeHandlerIntf";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { TypeBase } from "./base/TypeBase";

const win: any = window;

export class CalcTypeHandler extends TypeBase {

    constructor() {
        // false=disabling user's ability to select
        super(J.NodeType.CALCULATOR, "Calculator", "fa-calculator", false);
    }

    getEditorHelp(): string {
        const state = getAppState();
        return state.config.help?.type?.calculator?.editor;
    }

    allowAction(action: NodeActionType, node: J.NodeInfo, appState: AppState): boolean {
        return true;
    }

    getAllowContentEdit(): boolean {
        return true;
    }

    render = (node: J.NodeInfo, tabData: TabIntf<any>, rowStyling: boolean, isTreeView: boolean, isLinkedNode: boolean, state: AppState): Comp => {
        if (!S.props.isMine(node, state)) {
            return new Div("Only the Owner of a Calculation node can run the calculation.");
        }

        // scripts are recommended to put all variables in 'window.q' to be safest
        win.q = {
            logs: [],
            log: (v: any) => {
                win.q.logs.push(v);
            },
            formatCurrency: S.util.formatCurrency
        };

        try {
            let script = node.content;
            script = this.addFinalScript(script);
            win.eval(script);
            return new Pre(win.q.logs.join("\n"), { className: "calcOutputArea" });
        }
        catch (e) {
            return new Pre(e.message + "\n" + e.stack, { className: "calcOutputArea" });
        }
        finally {
            win.q = null;
        }
    }

    // Prints the values of all properts that were assigned to 'qc' during the running of the script, so that
    // instead of logging a value by calling q.log, you can just make sure the variable is one like 'q.myVar' and
    // it's final value will always be printed.
    addFinalScript = (script: string) => {
        return script + `\n
            for (let prop in q) {
                if (q.hasOwnProperty(prop)) {
                    if (prop!="log" && prop!="logs" && prop!="formatCurrency") {
                        q.log(prop+": "+q[prop]);
                    }
                }
            }
        `;
    }

    ensureDefaultProperties(node: J.NodeInfo) {
        // this has the unintended behavior of when the user tries to clear out the text it comes back in realtime.
        // if (!node.content) {
        //     node.content = "qc.a=23;\nqc.b=19;\n\nq.log('Answer=' + (qc.a + qc.b));";
        // }
    }
}
