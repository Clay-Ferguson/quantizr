import * as J from "../JavaIntf";
import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { TypeBase } from "./base/TypeBase";
import { AppState } from "../AppState";
import { Comp } from "../widget/base/Comp";
import { Heading } from "../widget/Heading";
import { HorizontalLayout } from "../widget/HorizontalLayout";

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

    allowAction(action : string): boolean {
        switch (action) {
            case "editNode":
                return false;
            default:
                return true;
        }
    }

    //todo-0: for node types FriendList and UserFeed need to remove buttons during edit mode for
    //'new', 'edit', 'cut'
    render(node: J.NodeInfo, rowStyling: boolean, state: AppState): Comp {

        let user: string = S.props.getNodePropVal(J.NodeProp.USER, node);
        return new HorizontalLayout([
            new Heading(4, "Posts: "+node.owner, {
                className: "marginAll"
            }),
        ]);
    }
}
