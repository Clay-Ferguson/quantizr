import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { UserProfileDlg } from "../dlg/UserProfileDlg";
import { FollowersRSInfo } from "../FollowersRSInfo";
import { TabDataIntf } from "../intf/TabDataIntf";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { CompIntf } from "../widget/base/CompIntf";
import { Heading } from "../widget/Heading";
import { ResultSetView } from "./ResultSetView";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class FollowersResultSetView<I extends FollowersRSInfo> extends ResultSetView {

    constructor(state: AppState, data: TabDataIntf) {
        super(state, data);
        data.inst = this;
    }

    pageChange(delta: number): void {
        let info = this.data.rsInfo as FollowersRSInfo;
        S.srch.showFollowers(delta === 0 ? 0 : info.page + delta, info.showingFollowersOfUser);
    }

    renderHeading(state: AppState): CompIntf {
        let info = this.data.rsInfo as FollowersRSInfo;
        let text = info.showingFollowersOfUser === state.userName //
            ? "Your followers..." //
            : "Followers of @" + info.showingFollowersOfUser + "...";
        return new Heading(4, text, { className: "resultsTitle" });
    }

    /* Renders the info for the OWNER of 'node', and not the content of the actual node, becasue the content will basically
    all be the same here which will be the user being followed, and is not needed to be displayed.

    This node needs to share as much implementation for item rendering as possible with what's done in the, FriendTypeHandler
    Probably need a static method on FriendTypeHandler itself which can do everything based on input parameters only.
    */
    renderItem(node: J.NodeInfo, i: number, childCount: number, rowCount: number, jumpButton: boolean, state: AppState): CompIntf {
        // console.log("Render Follower: " + S.util.prettyPrint(node));

        // let user: string = S.props.getNodePropVal(J.NodeProp.USER, node);
        // let userBio: string = S.props.getClientPropVal(J.NodeProp.USER_BIO, node);
        // let userNodeId: string = S.props.getNodePropVal(J.NodeProp.USER_NODE_ID, node);

        // let actorUrl = S.props.getClientPropVal(J.NodeProp.ACT_PUB_ACTOR_URL, node);
        let displayName = S.props.getClientPropVal(J.NodeProp.DISPLAY_NAME, node);
        let accntUser = S.props.getClientPropVal("accntUser", node);
        let imgSrc = S.props.getClientPropVal(J.NodeProp.ACT_PUB_USER_ICON_URL, node);

        /* If not ActivityPub try as local user */
        if (!imgSrc) {
            let avatarVer: string = S.props.getClientPropVal("avatarVer", node);
            let accntId: string = S.props.getClientPropVal("accntId", node);
            if (avatarVer) {
                imgSrc = S.render.getAvatarImgUrl(accntId, avatarVer);
            }
        }

        return S.render.renderUser(state, null, accntUser, null, null, imgSrc, null,
            displayName, "userFeedItem", "listFriendImage", false, (evt: any) => {
                new UserProfileDlg(node.ownerId, state).open();
            });
    }
}
