import { Comp } from "../comp/base/Comp";
import { Heading } from "../comp/core/Heading";
import { UserProfileDlg } from "../dlg/UserProfileDlg";
import { EditorOptions } from "../Interfaces";
import { TabIntf } from "../intf/TabIntf";
import { NodeActionType } from "../intf/TypeIntf";
import * as J from "../JavaIntf";
import { NodeInfo } from "../JavaIntf";
import { S } from "../Singletons";
import { TypeBase } from "./base/TypeBase";

export class FriendType extends TypeBase {
    static helpExpanded: boolean;

    constructor() {
        super(J.NodeType.FRIEND, "User", "fa-user", false);
    }

    override getEditorHelp(): string {
        return S.quanta.cfg.help?.type?.friend?.editor;
    }

    override getAllowRowHeader(): boolean {
        return false;
    }

    override allowAction(action: NodeActionType, _node: NodeInfo): boolean {
        switch (action) {
            case NodeActionType.delete:
            case NodeActionType.editNode:
                return true;
            default:
                return false;
        }
    }

    override getAllowPropertyAdd(): boolean {
        return false;
    }

    override getAllowContentEdit(): boolean {
        return false;
    }

    override allowPropertyEdit(_propName: string): boolean {
        return false;
    }

    override ensureDefaultProperties(node: NodeInfo) {
        this.ensureStringPropExists(node, J.NodeProp.USER);
    }

    override renderEditorSubPanel = (node: NodeInfo): Comp => {
        const user: string = S.props.getPropStr(J.NodeProp.USER, node);
        return new Heading(3, user);
    }

    override render = (node: NodeInfo, _tabData: TabIntf<any>, _rowStyling: boolean, isTreeView: boolean): Comp => {
        const user: string = S.props.getPropStr(J.NodeProp.USER, node);
        const userBio: string = S.props.getClientPropStr(J.NodeProp.USER_BIO, node);
        const userNodeId: string = S.props.getPropStr(J.NodeProp.USER_NODE_ID, node);
        const displayName = S.props.getClientPropStr(J.NodeProp.DISPLAY_NAME, node);
        let imgSrc = null;

        const avatarVer: string = S.props.getClientPropStr("avatarVer", node);
        if (avatarVer) {
            imgSrc = S.render.getAvatarImgUrl(userNodeId, avatarVer);
        }

        // Note: we pass showMessageButton as true when isTreeView is true only.
        return S.render.renderUser(node, user, userBio, imgSrc,
            displayName, null, isTreeView ? "treeFriendImage" : "listFriendImage", isTreeView, () => {
                new UserProfileDlg(userNodeId).open();
            });
    }

    override getEditorOptions(): EditorOptions {
        return {
            tags: true
        };
    }
}
