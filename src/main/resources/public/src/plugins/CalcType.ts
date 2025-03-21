import { Comp } from "../comp/base/Comp";
import { Div } from "../comp/core/Div";
import { Markdown } from "../comp/core/Markdown";
import { Pre } from "../comp/core/Pre";
import { TabBase } from "../intf/TabBase";
import { NodeActionType } from "../intf/TypeIntf";
import * as J from "../JavaIntf";
import { NodeInfo } from "../JavaIntf";
import { S } from "../Singletons";
import { TypeBase } from "./base/TypeBase";

const win: any = window;

export class CalcType extends TypeBase {

    constructor() {
        // false=disabling user's ability to select
        super(J.NodeType.CALCULATOR, "Calculator", "fa-calculator", true);
    }

    override getEditorHelp(): string {
        return S.quanta.cfg.help?.type?.calculator?.editor;
    }

    override allowAction(_action: NodeActionType, _node: NodeInfo): boolean {
        return true;
    }

    override getAllowContentEdit(): boolean {
        return true;
    }

    override render = (node: NodeInfo, _tabData: TabBase<any>, _rowStyling: boolean, _isTreeView: boolean): Comp => {
        if (!S.props.isMine(node)) {
            return new Div("Only the Owner of a Calculation node can run the calculation.");
        }

        // scripts are recommended to put all variables in 'window.q' to be safest
        win.q = {
            logs: [],
            log: (v: any) => {
                win.q.logs.push(v);
            },
            formatCurrency: S.util._formatCurrency
        };

        let script = "";
        let markdown = "";
        let markdownFinished = false;

        const lines: string[] = node.content.split(/\r?\n/);
        lines.forEach(line => {
            line = line.trim();
            if (!markdownFinished && line.startsWith("//") && line.length > 2) {
                markdown += line.substring(2) + "\n";
            }
            else {
                markdownFinished = true;
                script += line + "\n";
            }
        });

        let outputComp: Pre = null;
        try {
            script = this.addFinalScript(script);
            win.eval(script);
            outputComp = new Pre(win.q.logs.join("\n"), { className: "calcOutputArea" });
        }
        catch (e: any) {
            outputComp = new Pre(e.message + "\n" + e.stack, { className: "calcOutputArea" });
        }
        finally {
            win.q = null;
        }

        return new Div(null, null, [markdown ? new Markdown(markdown) : null, outputComp]);
    }

    // Prints the values of all properts that were assigned to 'qc' during the running of the
    // script, so that instead of logging a value by calling q.log, you can just make sure the
    // variable is one like 'q.myVar' and it's final value will always be printed.
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

    override ensureDefaultProperties(_node: NodeInfo) {
        // this has the unintended behavior of when the user tries to clear out the text it comes back in realtime.
        // if (!node.content) {
        //     node.content = "q.a=23;\a.b=19;\n\q.log('Answer=' + (q.a + q.b));";
        // }
    }
}
