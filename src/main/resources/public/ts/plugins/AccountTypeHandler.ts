import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { NodeActionType } from "../enums/NodeActionType";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "../widget/base/Comp";
import { Heading } from "../widget/Heading";
import { HorizontalLayout } from "../widget/HorizontalLayout";
import { TypeBase } from "./base/TypeBase";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class AccountTypeHandler extends TypeBase {

    constructor() {
        super(J.NodeType.ACCOUNT, "Account Root", "fa-database", false);
    }

    allowAction(action: NodeActionType, node: J.NodeInfo, appState: AppState): boolean {
        switch (action) {
            case NodeActionType.editNode:
                return false;
            default:
                return true;
        }
    }

    allowPropertyEdit(propName: string, state: AppState): boolean {
        return true;
    }

    render(node: J.NodeInfo, rowStyling: boolean, state: AppState): Comp {
        return new HorizontalLayout([
            new Heading(4, "User Account: "+node.owner, {
                className: "marginAll"
            })
        ]);
    }
}
