import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { NodeActionType } from "../enums/NodeActionType";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "../widget/base/Comp";
import { Clearfix } from "../widget/Clearfix";
import { Div } from "../widget/Div";
import { Heading } from "../widget/Heading";
import { HelpButton } from "../widget/HelpButton";
import { TypeBase } from "./base/TypeBase";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class FriendsListTypeHandler extends TypeBase {
    constructor() {
        super(J.NodeType.FRIEND_LIST, "Friends List", "fa-users", false);
    }

    allowAction(action: NodeActionType, node: J.NodeInfo, appState: AppState): boolean {
        return false;
    }

    render(node: J.NodeInfo, rowStyling: boolean, isTreeView: boolean, state: AppState): Comp {
        return new Div(null, null, [
            new HelpButton(() => S.quanta?.config?.help?.type?.friendsList?.render, null, "btn-secondary float-right"),
            new Heading(4, "Friends List", {
                className: "marginAll"
            })
        ]);
    }
}
