import * as J from "../JavaIntf";
import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { TypeBase } from "./base/TypeBase";
import { Heading } from "../widget/Heading";
import { Comp } from "../widget/base/Comp";
import { AppState } from "../AppState";
import { Div } from "../widget/Div";
import { Img } from "../widget/Img";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class FriendTypeHandler extends TypeBase {
    constructor() {
        super(J.NodeType.FRIEND, "Friend", "fa-user", true);
    }

    allowAction(action: string, node: J.NodeInfo, appState: AppState): boolean {
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

        let avatarVer: string = S.props.getNodePropVal("_avatarVer", node);
        let userBio: string = S.props.getNodePropVal("_userBio", node);
        let userNodeId: string = S.props.getNodePropVal(J.NodeProp.USER_NODE_ID, node);

        let img: Img = null;
        if (avatarVer) {
            let src: string = S.render.getAvatarImgUrl(userNodeId, avatarVer);
            if (src) {
                img = new Img(null, {
                    className: "friendImage",
                    src,
                });
            }
        }
        return new Div(null, {
            className: "row marginLeft"
        }, [
            img,
            new Div(null, null, [
                new Heading(4, "User: " + (user ? user : ""), {
                    className: "marginAll"
                }),
                new Div(userBio, {
                    className: "userBio"
                })])
        ]);
    }
}
