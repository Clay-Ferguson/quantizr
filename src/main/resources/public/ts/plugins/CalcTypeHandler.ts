import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { NodeActionType } from "../enums/NodeActionType";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "../widget/base/Comp";
import { Div } from "../widget/Div";
import { TypeBase } from "./base/TypeBase";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

let win: any = window;
win.qlogs = [];
win.qlog = (v) => {
    win.qlogs.push(v);
};

export class CalcTypeHandler extends TypeBase {

    constructor() {
        super(J.NodeType.CALCULATOR, "Calculator", "fa-calculator", true);
    }

    allowAction(action: NodeActionType, node: J.NodeInfo, appState: AppState): boolean {
        return true;
    }

    getAllowContentEdit(): boolean {
        return true;
    }

    render(node: J.NodeInfo, rowStyling: boolean, state: AppState): Comp {
        if (!S.props.isMine(node, state)) {
            return new Div("Only the Owner of a Calculation node can run the calculation.");
        }

        win.qlogs = [];
        win.eval(node.content);

        let div = new Div(null, { className: "calcOutputArea" });
        for (let s of win.qlogs) {
            div.addChild(new Div(s));
        }
        return div;
    }

    ensureDefaultProperties(node: J.NodeInfo) {
        if (!node.content) {
            node.content = "a=1;\nb=2;\nqlog(a+b);";
        }
    }
}
