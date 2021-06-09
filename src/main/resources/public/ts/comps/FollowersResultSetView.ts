import { store } from "../AppRedux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { UserProfileDlg } from "../dlg/UserProfileDlg";
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

export class FollowersResultSetView extends ResultSetView {

    constructor(data: TabDataIntf) {
        super(data);
    }

    pageChange(delta: number): void {
        let state: AppState = store.getState();
        S.srch.showFollowers(delta === 0 ? 0 : this.data.rsInfo.page + delta,
            this.data.rsInfo.showingFollowersOfUser);
    }

    renderHeading(): CompIntf {
        return new Heading(4, "Followers (@" + this.data.rsInfo.showingFollowersOfUser + ")", { className: "resultsTitle" });
    }

    /* Renders the info for the OWNER of 'node', and not the content of the actual node, becasue the content will basically
    all be the same here which will be the user being followed, and is not needed to be displayed.

    This node needs to share as much implementation for item rendering as possible with what's done in the, FriendTypeHandler
    Probably need a static method on FriendTypeHandler itself which can do everything based on input parameters only.
    */
    renderItem(node: J.NodeInfo, i: number, childCount: number, rowCount: number, jumpButton: boolean, state: AppState): CompIntf {
        if (node.owner.indexOf("@") !== -1) {
            return null;
        }

        let userNodeId: string = S.props.getNodePropVal(J.NodeProp.USER_NODE_ID, node);
        let imgSrc = node.avatarVer ? S.render.getAvatarImgUrl(node.ownerId, node.avatarVer) : null;

        return S.render.renderUser(state, node.id, node.owner, null, userNodeId, imgSrc, null,
            node.displayName, "userFeedItem", false, (evt: any) => {
                new UserProfileDlg(node.ownerId, state).open();
            });
    }
}
