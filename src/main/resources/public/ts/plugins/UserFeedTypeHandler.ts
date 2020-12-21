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

/* Type of node that hosts the user's social media posts, which I think will
also have an option to include (or not) other friends who they are following.

NOTE: This node really should have been called "OUTBOX". We can rename it eventually.
*/
export class UserFeedTypeHandler extends TypeBase {
    constructor() {
        super(J.NodeType.USER_FEED, "Outbox", "fa-th-list", true);
    }

    allowAction(action: NodeActionType, node: J.NodeInfo, appState: AppState): boolean {
        switch (action) {
            case NodeActionType.addChild:
                return S.props.isMine(node, appState) || appState.isAdminUser;
            case NodeActionType.editNode:
                return false;
            default:
                return true;
        }
    }

    render(node: J.NodeInfo, rowStyling: boolean, state: AppState): Comp {
        return new Div(null, null, [
            new Heading(4, "Outbox: " + node.owner, {
                className: "marginAll"
            })
        ]);
    }
}
