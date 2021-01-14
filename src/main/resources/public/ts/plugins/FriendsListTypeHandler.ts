import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { NodeActionType } from "../enums/NodeActionType";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "../widget/base/Comp";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { CollapsibleHelpPanel } from "../widget/CollapsibleHelpPanel";
import { Div } from "../widget/Div";
import { Heading } from "../widget/Heading";
import { HorizontalLayout } from "../widget/HorizontalLayout";
import { TypeBase } from "./base/TypeBase";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class FriendsListTypeHandler extends TypeBase {
    static helpExpanded: boolean;

    constructor() {
        super(J.NodeType.FRIEND_LIST, "Friends List", "fa-users", true);
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

        // let user: string = S.props.getNodePropVal(J.NodeProp.USER, node);
        return new HorizontalLayout([
            new Heading(4, "Friends List", {
                className: "marginAll"
            }),
            new ButtonBar([
                new Button("Add Friend", () => S.edit.addFriend(node, state), {
                    title: "Add a new friend to this list of friends."
                })
            ], null, "float-right marginBottom"),
            new Div(null, { className: "clearfix" }),
            new CollapsibleHelpPanel("This node defines your list of friends, as it's subnodes (i.e. who you follow on the Fediverse or this server will be defined by the children of this node).<p>" +
                    "Use the 'Add Friend' button to add a new friend, and their content will then show up in your Feed tab <p>" +
                    "You can access your Feed by clicking the 'Feed' link at the top of the page.",
                (state: boolean) => {
                    FriendsListTypeHandler.helpExpanded = state;
                }, FriendsListTypeHandler.helpExpanded)
        ]);
    }
}
