import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { NodeActionType } from "../enums/NodeActionType";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "../widget/base/Comp";
import { Div } from "../widget/Div";
import { Heading } from "../widget/Heading";
import { TypeBase } from "./base/TypeBase";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

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

        // eslint-disable-next-line no-eval
        window.eval(node.content);

        let div = new Div();
        div.addChild(new Heading(3, "Calculation", { className: "marginLeft marginTop marginBottom" }));
        Object.keys(window).forEach(function (key) {
            if (key.startsWith("_")) {
                if (node.content.indexOf(key + " ") !== -1 || node.content.indexOf(key + "=") !== -1) {
                    // eslint-disable-next-line no-eval
                    div.addChild(new Heading(4, key + " = " + window.eval(key), { className: "marginLeft" }));
                }
            }
        });
        return div;
    }

    ensureDefaultProperties(node: J.NodeInfo) {
        debugger;
        if (!node.content) {
            node.content = "_a=1;\n_b=2;\n_c=_a+_b;";
        }
    }
}
