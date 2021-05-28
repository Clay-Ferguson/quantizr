import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { UserProfileDlg } from "../dlg/UserProfileDlg";
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
        super(J.NodeType.FRIEND, "Friend", "fa-user", false);
    }

    getEditorHelp(): string {
        return S.meta64.config.help.type.friend.editor;
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
        let imgSrc: string = null;
        if (avatarVer) {
            imgSrc = S.render.getAvatarImgUrl(userNodeId, avatarVer);
        }

        // finally resort to looking for avatar url as a client property which will be how it's found for Foreign Federated users.
        if (!imgSrc) {
            imgSrc = S.props.getClientPropVal(J.NodeProp.ACT_PUB_USER_ICON_URL, node);
        }

        let actorUrl = S.props.getClientPropVal(J.NodeProp.ACT_PUB_ACTOR_URL, node);

        if (imgSrc) {
            img = new Img(null, {
                className: "friendImage",
                align: "left", // causes text to flow around
                src: imgSrc,
                onClick: (evt: any) => {
                    new UserProfileDlg(userNodeId, state).open();
                }
            });
        }

        return new Div(null, {
            // className: "marginLeft"
        }, [
            img,
            new Div(null, null, [
                // todo-0: need to somehow make the server send us the displayName to show here.
                new Heading(4, "User: " + (user || ""), {
                    className: "marginAll"
                }),
                new Html(userBio, {
                    className: "userBio"
                })]),
            new Div(null, null, [
                new ButtonBar([
                    new Button("Message", S.edit.newSubNode, {
                        title: "Send Private Message",
                        nid: node.id
                    }),
                    actorUrl ? new Button("Go to User Page", () => {
                        window.open(actorUrl, "_blank");
                    }) : null
                ], null, "float-right marginBottom"),
                new Div(null, { className: "clearfix" })]),
            new CollapsibleHelpPanel("Help", S.meta64.config.help.type.friend.render,
                (state: boolean) => {
                    FriendTypeHandler.helpExpanded = state;
                }, FriendTypeHandler.helpExpanded)
        ]);
    }
}
