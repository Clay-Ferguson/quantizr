import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { FollowingRSInfo } from "../FollowingRSInfo";
import { TabDataIntf } from "../intf/TabDataIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { CompIntf } from "../widget/base/CompIntf";
import { Heading } from "../widget/Heading";
import { ResultSetView } from "./ResultSetView";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class FollowingResultSetView<I extends FollowingRSInfo> extends ResultSetView {

    constructor(state: AppState, data: TabDataIntf) {
        super(state, data);
        this.allowHeader = false;
        this.allowFooter = false;
        data.inst = this;
    }

    pageChange(delta: number): void {
        let info = this.data.rsInfo as FollowingRSInfo;
        let page = info.page;

        // Yes the check against null IS required. Don't change.
        if (delta !== null) {
            page = delta === 0 ? 0 : info.page + delta;
        }
        S.srch.showFollowing(page, info.showingFollowingOfUser);
    }

    renderHeading(state: AppState): CompIntf {
        let info = this.data.rsInfo as FollowingRSInfo;
        return new Heading(4, "@" + info.showingFollowingOfUser + " is Following...", { className: "resultsTitle" });
    }
}
