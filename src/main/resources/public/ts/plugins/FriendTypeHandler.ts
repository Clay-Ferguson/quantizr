import { getAppState } from "../AppContext";
import { AppState } from "../AppState";
import { Comp } from "../comp/base/Comp";
import { Heading } from "../comp/core/Heading";
import { UserProfileDlg } from "../dlg/UserProfileDlg";
import { TabIntf } from "../intf/TabIntf";
import { NodeActionType } from "../intf/TypeHandlerIntf";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { TypeBase } from "./base/TypeBase";

export class FriendTypeHandler extends TypeBase {
    static helpExpanded: boolean;

    constructor() {
        super(J.NodeType.FRIEND, "User", "fa-user", false);
    }

    getEditorHelp(): string {
        const state = getAppState();
        return state.config.help?.type?.friend?.editor;
    }

    getAllowRowHeader(): boolean {
        return false;
    }

    allowAction(action: NodeActionType, node: J.NodeInfo, appState: AppState): boolean {
        switch (action) {
            case NodeActionType.delete:
            case NodeActionType.editNode:
                return true;
            default:
                return false;
        }
    }

    getEditLabelForProp(propName: string): string {
        if (propName === J.NodeProp.USER_TAGS) {
            return "Hashtags (Categories for this User)";
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
        return [J.NodeProp.USER_TAGS];
    }

    allowPropertyEdit(propName: string, state: AppState): boolean {
        if (propName === J.NodeProp.USER_TAGS) return true;
        return false;
    }

    ensureDefaultProperties(node: J.NodeInfo) {
        this.ensureStringPropExists(node, J.NodeProp.USER);
        this.ensureStringPropExists(node, J.NodeProp.USER_TAGS);
    }

    renderEditorSubPanel = (node: J.NodeInfo): Comp => {
        const user: string = S.props.getPropStr(J.NodeProp.USER, node);
        return new Heading(3, user);
    }

    render = (node: J.NodeInfo, tabData: TabIntf<any>, rowStyling: boolean, isTreeView: boolean, isLinkedNode: boolean, state: AppState): Comp => {
        const user: string = S.props.getPropStr(J.NodeProp.USER, node);
        const userBio: string = S.props.getClientPropStr(J.NodeProp.USER_BIO, node);
        const userNodeId: string = S.props.getPropStr(J.NodeProp.USER_NODE_ID, node);
        const actorUrl = S.props.getClientPropStr(J.NodeProp.ACT_PUB_ACTOR_URL, node);
        const displayName = S.props.getClientPropStr(J.NodeProp.DISPLAY_NAME, node);
        let imgSrc = S.props.getClientPropStr(J.NodeProp.ACT_PUB_USER_ICON_URL, node);

        /* If not ActivityPub try as local user */
        if (!imgSrc) {
            const avatarVer: string = S.props.getClientPropStr("avatarVer", node);
            if (avatarVer) {
                imgSrc = S.render.getAvatarImgUrl(userNodeId, avatarVer);
            }
        }

        // Note: we pass showMessageButton as true when isTreeView is true only.
        return S.render.renderUser(node, user, userBio, imgSrc, actorUrl,
            displayName, null, isTreeView ? "treeFriendImage" : "listFriendImage", isTreeView, () => {
                new UserProfileDlg(userNodeId).open();
            });
    }
}
