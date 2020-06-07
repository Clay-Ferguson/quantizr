import * as J from "../JavaIntf";
import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { TypeBase } from "./base/TypeBase";
import { Heading } from "../widget/Heading";
import { Comp } from "../widget/base/Comp";
import { AppState } from "../AppState";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class FriendTypeHandler extends TypeBase {
    constructor() {
        super(J.NodeType.FRIEND, "Friend", "fa-user", true);
    }

    getCustomProperties(): string[] {
        return [J.NodeProp.USER,
            //content isn't a 'property' in the 'properties' array, but is a prop ON SubNode.java, so we don't have a J.NodeProp for it.    
            "content"];
    }

    allowPropertyEdit(propName: string, state: AppState): boolean {
        //USER_NODE_ID is generated and maintained by the server, and we can ignore it in the editor.
        return propName != J.NodeProp.USER_NODE_ID;
    }

    ensureDefaultProperties(node: J.NodeInfo) {
        this.ensureStringPropExists(node, J.NodeProp.USER);
    }

    render(node: J.NodeInfo, rowStyling: boolean, state: AppState): Comp {

        let user: string = S.props.getNodePropVal(J.NodeProp.USER, node);
        return new Heading(4, "User: " + (user ? user : ""), {
            className: "marginAll"
        });
    }
}
