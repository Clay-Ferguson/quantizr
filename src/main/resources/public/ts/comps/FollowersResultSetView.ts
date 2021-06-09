import { store } from "../AppRedux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { UserProfileDlg } from "../dlg/UserProfileDlg";
import { TabDataIntf } from "../intf/TabDataIntf";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { CompIntf } from "../widget/base/CompIntf";
import { Div } from "../widget/Div";
import { Heading } from "../widget/Heading";
import { Img } from "../widget/Img";
import { Span } from "../widget/Span";
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
        return new Heading(4, "Followers of @" + this.data.rsInfo.showingFollowersOfUser, { className: "resultsTitle" });
    }

    /* Renders the info for the OWNER of 'node', and not the content of the actual node, becasue the content will basically
    all be the same here which will be the user being followed, and is not needed to be displayed */
    renderItem(node: J.NodeInfo, i: number, childCount: number, rowCount: number, jumpButton: boolean, state: AppState): CompIntf {

        // todo-0: detect if this is a foreign user and don't render them. WE don't support that yet.
        if (node.owner.indexOf("@") !== -1) {
            return null;
        }

        let ret = new Div(null, {
            onClick: (evt: any) => {
                new UserProfileDlg(node.ownerId, state).open();
            }
        });

        let src: string = null;
        if (node.avatarVer) {
            src = S.render.getAvatarImgUrl(node.ownerId, node.avatarVer);
        }
        let img: Img = null;

        if (src) {
            img = new Img(null, {
                className: "friendListImage",
                src: src
            });
        }

        let friendDisplay = node.displayName
            ? node.displayName + " (@" + node.owner + ")"
            : ("@" + node.owner);

        ret.setChildren([
            new Div(null, {
                className: "unselectedListItem"
            }, [
                img,
                new Span(friendDisplay, { className: "friendListText" })
            ])
        ]);

        return ret;
    }
}
