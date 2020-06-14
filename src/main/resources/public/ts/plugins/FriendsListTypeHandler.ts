import * as J from "../JavaIntf";
import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { TypeBase } from "./base/TypeBase";
import { AppState } from "../AppState";
import { Comp } from "../widget/base/Comp";
import { Heading } from "../widget/Heading";
import { HorizontalLayout } from "../widget/HorizontalLayout";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { Div } from "../widget/Div";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class FriendsListTypeHandler extends TypeBase {
    constructor() {
        super(J.NodeType.FRIEND_LIST, "Friends List", "fa-users", true);
    }

    allowAction(action : string): boolean {
        switch (action) {
            case "editNode":
                return false;
            default:
                return true;
        }
    }

    render(node: J.NodeInfo, rowStyling: boolean, state: AppState): Comp {

        let user: string = S.props.getNodePropVal(J.NodeProp.USER, node);
        return new HorizontalLayout([
            new Heading(4, "Friends List", {
                className: "marginAll"
            }),
            new ButtonBar([
                new Button("Add Friend", () => S.edit.addFriend(node, state), {
                    title: "Add a new friend to this list of friends."
                }),

                // DO NOT DELETE (YET)
                // this is no longer needed here, since it's on the main menu now but i'll leave it for now commented out.
                // new Button("Show Feed", () => S.srch.feed(node.id), {
                //     title: "Show Timeline of all your Friends' Posts"
                // })
            ], null, "float-right marginBottom"),
            new Div(null, { className: "clearfix" })
        ]);
    }
}
