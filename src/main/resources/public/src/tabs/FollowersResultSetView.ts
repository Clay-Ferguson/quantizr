import { getAs } from "../AppContext";
import { Comp } from "../comp/base/Comp";
import { Div } from "../comp/core/Div";
import { UserProfileDlg } from "../dlg/UserProfileDlg";
import { FollowersRSInfo } from "../FollowersRSInfo";
import { TabBase } from "../intf/TabBase";
import * as J from "../JavaIntf";
import { NodeInfo } from "../JavaIntf";
import { S } from "../Singletons";
import { ResultSetView } from "./ResultSetView";

export class FollowersResultSetView<PT extends FollowersRSInfo> extends ResultSetView<PT, FollowersResultSetView<PT>> {

    constructor(data: TabBase<PT, FollowersResultSetView<PT>>) {
        super(data);
        data.inst = this;
        this.showContentHeading = false;
    }

    override pageChange(delta: number): void {
        let page = this.data.props.page;

        // Yes the check against null IS required. Don't change.
        if (delta !== null) {
            page = delta === 0 ? 0 : this.data.props.page + delta;
        }
        S.srch.showFollowers(page, this.data.props.showingFollowersOfUser);
    }

    override renderHeading(): Comp {
        const text = this.data.props.showingFollowersOfUser === getAs().userName //
            ? "Your Followers" //
            : "Followers of @" + this.data.props.showingFollowersOfUser;
        return new Div(text, { className: "tabTitle" });
    }

    /* Renders the info for the OWNER of 'node', and not the content of the actual node, because the
    content will basically all be the same here which will be the user being followed, and is not
    needed to be displayed.

    This node needs to share as much implementation for item rendering as possible with what's done
    in the, FriendType Probably need a static method on FriendType itself which can do everything
    based on input parameters only.
    */
    override renderItem(node: NodeInfo, _i: number, _rowCount: number, _jumpButton: boolean): Comp {
        // let user: string = S.props.getNodePropVal(J.NodeProp.USER, node);
        // let userBio: string = S.props.getClientPropVal(J.NodeProp.USER_BIO, node);
        // let userNodeId: string = S.props.getNodePropVal(J.NodeProp.USER_NODE_ID, node);

        const displayName = S.props.getClientPropStr(J.NodeProp.DISPLAY_NAME, node);
        const accntUser = S.props.getClientPropStr("accntUser", node);

        // We can end up here with a null accntUser, if this user has been deleted, but the
        // server can't fix this itself because it has to expect the user is simply not yet created
        // so we cope with this by ignoring any who don't have an accntUser name here.
        if (!accntUser) {
            return null;
        }
        let imgSrc = null;
        const avatarVer: string = S.props.getClientPropStr("avatarVer", node);
        const accntId: string = S.props.getClientPropStr("accntId", node);
        if (avatarVer) {
            imgSrc = S.render.getAvatarImgUrl(accntId, avatarVer);
        }

        return S.render.renderUser(null, accntUser, null, imgSrc,
            displayName, "userFeedItem", "listFriendImage", false, (_evt: any) => {
                new UserProfileDlg(node.ownerId).open();
            });
    }

    override extraPagingComps(): Comp[] {
        return null;
    }

    override getFloatRightHeaderComp(): Comp {
        return null;
    }
}
