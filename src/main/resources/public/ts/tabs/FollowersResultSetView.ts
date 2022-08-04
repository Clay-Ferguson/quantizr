import { AppState } from "../AppState";
import { CompIntf } from "../comp/base/CompIntf";
import { Heading } from "../comp/core/Heading";
import { UserProfileDlg } from "../dlg/UserProfileDlg";
import { FollowersRSInfo } from "../FollowersRSInfo";
import { TabIntf } from "../intf/TabIntf";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { ResultSetView } from "./ResultSetView";

export class FollowersResultSetView<I extends FollowersRSInfo> extends ResultSetView {

    constructor(data: TabIntf) {
        super(data);
        data.inst = this;
        this.showContentHeading = false;
    }

    pageChange(delta: number): void {
        const info = this.data.rsInfo as FollowersRSInfo;
        let page = info.page;

        // Yes the check against null IS required. Don't change.
        if (delta !== null) {
            page = delta === 0 ? 0 : info.page + delta;
        }
        S.srch.showFollowers(page, info.showingFollowersOfUser);
    }

    renderHeading(state: AppState): CompIntf {
        const info = this.data.rsInfo as FollowersRSInfo;
        const text = info.showingFollowersOfUser === state.userName //
            ? "Your followers..." //
            : "Followers of @" + info.showingFollowersOfUser + "...";
        return new Heading(4, text, { className: "resultsTitle" });
    }

    /* Renders the info for the OWNER of 'node', and not the content of the actual node, becasue the content will basically
    all be the same here which will be the user being followed, and is not needed to be displayed.

    This node needs to share as much implementation for item rendering as possible with what's done in the, FriendTypeHandler
    Probably need a static method on FriendTypeHandler itself which can do everything based on input parameters only.
    */
    renderItem(node: J.NodeInfo, i: number, rowCount: number, jumpButton: boolean, state: AppState): CompIntf {
        // console.log("Render Follower: " + S.util.prettyPrint(node));

        // let user: string = S.props.getNodePropVal(J.NodeProp.USER, node);
        // let userBio: string = S.props.getClientPropVal(J.NodeProp.USER_BIO, node);
        // let userNodeId: string = S.props.getNodePropVal(J.NodeProp.USER_NODE_ID, node);

        // let actorUrl = S.props.getClientPropVal(J.NodeProp.ACT_PUB_ACTOR_URL, node);
        const displayName = S.props.getClientPropStr(J.NodeProp.DISPLAY_NAME, node);
        const accntUser = S.props.getClientPropStr("accntUser", node);
        let imgSrc = S.props.getClientPropStr(J.NodeProp.ACT_PUB_USER_ICON_URL, node);

        /* If not ActivityPub try as local user */
        if (!imgSrc) {
            const avatarVer: string = S.props.getClientPropStr("avatarVer", node);
            const accntId: string = S.props.getClientPropStr("accntId", node);
            if (avatarVer) {
                imgSrc = S.render.getAvatarImgUrl(accntId, avatarVer);
            }
        }

        return S.render.renderUser(null, accntUser, null, imgSrc, null,
            displayName, "userFeedItem", "listFriendImage", false, (evt: any) => {
                new UserProfileDlg(node.ownerId).open();
            });
    }
}
