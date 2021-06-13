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

    constructor(data: TabDataIntf) {
        super(data);
        this.allowHeader = false;
        this.allowFooter = false;
    }

    pageChange(delta: number): void {
        let info = this.data.rsInfo as FollowingRSInfo;
        S.srch.showFollowing(delta === 0 ? 0 : info.page + delta, info.showingFollowingOfUser);
    }

    renderHeading(): CompIntf {
        let info = this.data.rsInfo as FollowingRSInfo;
        return new Heading(4, "@" + info.showingFollowingOfUser + " is Following...", { className: "resultsTitle" });
    }
}
