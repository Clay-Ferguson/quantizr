import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { NodeActionType } from "../enums/NodeActionType";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "../widget/base/Comp";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Div } from "../widget/Div";
import { Heading } from "../widget/Heading";
import { TypeBase } from "./base/TypeBase";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class TrashNodeTypeHandler extends TypeBase {
    constructor() {
        super(J.NodeType.TRASH_BIN, "Trash Bin", "fa-trash", false);
    }

    allowAction(action: NodeActionType, node: J.NodeInfo, appState: AppState): boolean {
        // switch (action) {
        //     case NodeActionType.editNode:
        //         return false;
        //     default:
        //         return true;
        // }
        return false;
    }

    render(node: J.NodeInfo, rowStyling: boolean, state: AppState): Comp {
        return new Div(null, null, [
            new Heading(4, "Trash Bin", {
                className: "marginAll"
            }),
            new ButtonBar([
                new Button("Empty Trash", () => {
                    S.edit.emptyTrash(state);
                })
            ], null, "float-right marginBottom"),
            new Div(null, { className: "clearfix" })
        ]);
    }
}
