import * as J from "../JavaIntf";
import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { TypeBase } from "./base/TypeBase";
import { AppState } from "../AppState";
import { Comp } from "../widget/base/Comp";
import { Heading } from "../widget/Heading";
import { HorizontalLayout } from "../widget/HorizontalLayout";
import { Div } from "../widget/Div";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { NodeActionType } from "../enums/NodeActionType";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* Type of node that hosts the user's social media posts, which I think will
also have an option to include (or not) other friends who they are following */
export class UserFeedTypeHandler extends TypeBase {
    constructor() {
        super(J.NodeType.USER_FEED, "User Feed", "fa-th-list", true);
    }

    allowAction(action: NodeActionType, node: J.NodeInfo, appState: AppState): boolean {

        switch (action) {
            case NodeActionType.addChild:
                return S.props.isMine(node, appState);
            case NodeActionType.editNode:
                return false;
            default:
                return true;
        }
    }

    //todo-0: for node types FriendList and UserFeed need to remove buttons during edit mode for
    //'new', 'edit', 'cut'
    render(node: J.NodeInfo, rowStyling: boolean, state: AppState): Comp {

        let user: string = S.props.getNodePropVal(J.NodeProp.USER, node);
        return new Div(null, null, [
            new Heading(4, "Posts: " + node.owner, {
                className: "marginAll"
            }),

            // this works perfectly but might be confusing to user to have too many different buttons doing the same thing
            // new ButtonBar([
            //     new Button("Refresh Feed", () => {
            //         S.nav.navFeed(state)
            //     })
            // ], null, "float-right marginBottom"),
            //new Div(null, { className: "clearfix" })
        ]);
    }
}
