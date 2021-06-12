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
import { TypeBase } from "./base/TypeBase";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class FriendsListTypeHandler extends TypeBase {
    static helpExpanded: boolean;

    constructor() {
        super(J.NodeType.FRIEND_LIST, "Friends List", "fa-users", false);
    }

    allowAction(action: NodeActionType, node: J.NodeInfo, appState: AppState): boolean {
        return false;
    }

    render(node: J.NodeInfo, rowStyling: boolean, isTreeView: boolean, state: AppState): Comp {

        /* this is a slightly ugly coupling, between GUI and State, but it's also simple enough to
         not be a problem. */
        if (S.meta64.addFriendPending) {
            S.meta64.addFriendPending = false;
            setTimeout(() => S.edit.createNode(node, J.NodeType.FRIEND, state), 500);
        }

        return new Div(null, null, [
            new Heading(4, "Friends List", {
                className: "marginAll"
            }),
            new ButtonBar([
                new Button("Add Friend", () => S.edit.createNode(node, J.NodeType.FRIEND, state), {
                    title: "Add a new Friend (i.e. Follow someone)"
                })
            ], null, "float-right marginBottom"),
            new Div(null, { className: "clearfix" }),
            new CollapsibleHelpPanel("Help", S.meta64.config.help.type.friendsList.render,
                (state: boolean) => {
                    FriendsListTypeHandler.helpExpanded = state;
                }, FriendsListTypeHandler.helpExpanded)
        ]);
    }
}
