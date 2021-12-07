import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { NodeActionType } from "../enums/NodeActionType";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "../comp/base/Comp";
import { Clearfix } from "../comp/Clearfix";
import { Div } from "../comp/Div";
import { Heading } from "../comp/Heading";
import { HelpButton } from "../comp/HelpButton";
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
            new HelpButton(() => S.quanta?.config?.help?.type?.friendsList?.render, null, "btn-secondary float-end"),
            new Heading(4, "Friends List", {
                className: "marginAll"
            })
        ]);
    }

    isSpecialAccountNode(): boolean {
        return true;
    }

    subOrdinal(): number {
        return 2;
    }
}
