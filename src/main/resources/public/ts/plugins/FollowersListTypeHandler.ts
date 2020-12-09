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

export class FollowersListTypeHandler extends TypeBase {
    constructor() {
        super(J.NodeType.FOLLOWERS_LIST, "Followers List", "fa-users", true);
    }

    allowAction(action: NodeActionType, node: J.NodeInfo, appState: AppState): boolean {
        return false;
    }

    render(node: J.NodeInfo, rowStyling: boolean, state: AppState): Comp {

        // let user: string = S.props.getNodePropVal(J.NodeProp.USER, node);
        return new HorizontalLayout([
            new Heading(4, "Followers List", {
                className: "marginAll"
            })
        ]);
    }
}
