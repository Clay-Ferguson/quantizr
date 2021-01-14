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
import { Html } from "../widget/Html";
import { Img } from "../widget/Img";
import { TypeBase } from "./base/TypeBase";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class FriendTypeHandler extends TypeBase {
    static helpExpanded: boolean;

    constructor() {
        super(J.NodeType.FRIEND, "Friend", "fa-user", true);
    }

    getEditorHelp(): string {
        return "Enter the name of a friend on the local server as something like <b>'bob'</b> (without quotes)<p>" +
            "or enter a Foreign Fediverse server user name formatted like this <b>'bob@domain.com'</b> (without quotes)";
    }

    allowAction(action: NodeActionType, node: J.NodeInfo, appState: AppState): boolean {
        switch (action) {
            case NodeActionType.delete:
                return true;
            default:
                return false;
        }
    }

    getEditLabelForProp(propName: string): string {
        if (propName === J.NodeProp.USER) {
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
        // USER_NODE_ID is generated and maintained by the server, and we can ignore it in the editor.
        return propName === J.NodeProp.USER;
    }

    ensureDefaultProperties(node: J.NodeInfo) {
        this.ensureStringPropExists(node, J.NodeProp.USER);
    }

    render(node: J.NodeInfo, rowStyling: boolean, state: AppState): Comp {
        let user: string = S.props.getNodePropVal(J.NodeProp.USER, node);

        let avatarVer: string = S.props.getClientPropVal("avatarVer", node);
        let userBio: string = S.props.getClientPropVal(J.NodeProp.USER_BIO, node);
        let userNodeId: string = S.props.getNodePropVal(J.NodeProp.USER_NODE_ID, node);

        let img: Img = null;
        let src: string = null;
        if (avatarVer) {
            src = S.render.getAvatarImgUrl(userNodeId, avatarVer);
        }

        // finally resort to looking for avatar url as a client property which will be how it's found for Foreign Federated users.
        if (!src) {
            src = S.props.getClientPropVal(J.NodeProp.ACT_PUB_USER_ICON_URL, node);
        }

        let actPubActorUrl = S.props.getClientPropVal(J.NodeProp.ACT_PUB_ACTOR_URL, node);

        if (src) {
            img = new Img(null, {
                className: "friendImage",
                align: "left", // causes text to flow around
                src,
                onClick: actPubActorUrl ? () => {
                    window.open(actPubActorUrl, "_blank");
                } : null
            });
        }

        // todo-0: this is an ugly hack but the users can get the idea who this is from the URL (for now)
        if (!user) {
            user = actPubActorUrl;
        }

        return new Div(null, {
            // className: "marginLeft"
        }, [
            img,
            new Div(null, null, [
                new Heading(4, "User: " + (user || ""), {
                    className: "marginAll"
                }),
                new Html(userBio, {
                    className: "userBio"
                })]),
            new Div(null, null, [
                new ButtonBar([
                    new Button("Message", S.meta64.getNodeFunc(S.edit.cached_newSubNode, "S.edit.newSubNode", node.id), {
                        title: "Send Private Message"
                    })
                ], null, "float-right marginBottom"),
                new Div(null, { className: "clearfix" })]),
            new CollapsibleHelpPanel("This node defines a friend on this server or another federated server. <br>" +
                "You can send a DM to this person using the 'Message' button, or delete this node to stop following the person.",
                (state: boolean) => {
                    FriendTypeHandler.helpExpanded = state;
                }, FriendTypeHandler.helpExpanded)
        ]);
    }
}
