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

    allowAction(action: string): boolean {
        switch (action) {
            case "upload":
                return false;
            default:
                return true;
        }
    }

    getEditLabelForProp(propName: string): string {
        if (propName == J.NodeProp.USER) {
            return "User Name";
        }
        return propName;
    }

    getAllowPropertyAdd(): boolean {
        return false;
    }

    getAllowContentEdit(): boolean {
        return false;
    }

    getCustomProperties(): string[] {
        return [J.NodeProp.USER];
    }

    allowPropertyEdit(propName: string, state: AppState): boolean {
        //USER_NODE_ID is generated and maintained by the server, and we can ignore it in the editor.
        return propName == J.NodeProp.USER;
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
