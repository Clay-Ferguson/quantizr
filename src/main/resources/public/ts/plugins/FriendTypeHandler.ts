import { store } from "../AppRedux";
import { AppState } from "../AppState";
import { Comp } from "../comp/base/Comp";
import { UserProfileDlg } from "../dlg/UserProfileDlg";
import { NodeActionType } from "../enums/NodeActionType";
import { TabIntf } from "../intf/TabIntf";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { TypeBase } from "./base/TypeBase";

export class FriendTypeHandler extends TypeBase {
    static helpExpanded: boolean;

    constructor() {
        super(J.NodeType.FRIEND, "User", "fa-user", false);
    }

    getEditorHelp(): string {
        let state = store.getState();
        return state.config?.help?.type?.friend?.editor;
    }

    getAllowRowHeader(): boolean {
        return false;
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

    render(node: J.NodeInfo, tabData: TabIntf<any>, rowStyling: boolean, isTreeView: boolean, state: AppState): Comp {
        let user: string = S.props.getPropStr(J.NodeProp.USER, node);
        let userBio: string = S.props.getClientPropStr(J.NodeProp.USER_BIO, node);
        let userNodeId: string = S.props.getPropStr(J.NodeProp.USER_NODE_ID, node);
        let actorUrl = S.props.getClientPropStr(J.NodeProp.ACT_PUB_ACTOR_URL, node);
        let displayName = S.props.getClientPropStr(J.NodeProp.DISPLAY_NAME, node);
        let imgSrc = S.props.getClientPropStr(J.NodeProp.ACT_PUB_USER_ICON_URL, node);

        /* If not ActivityPub try as local user */
        if (!imgSrc) {
            let avatarVer: string = S.props.getClientPropStr("avatarVer", node);
            if (avatarVer) {
                imgSrc = S.render.getAvatarImgUrl(userNodeId, avatarVer);
            }
        }

        // Note: we pass showMessageButton as true when isTreeView is true only.
        return S.render.renderUser(node.id, user, userBio, imgSrc, actorUrl,
            displayName, null, isTreeView ? "treeFriendImage" : "listFriendImage", isTreeView, (evt: any) => {
                new UserProfileDlg(userNodeId, state).open();
            });
    }
}
