import { store } from "../AppRedux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
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

export class FollowingResultSetView extends ResultSetView {

    constructor(data: TabDataIntf) {
        super(data);
        this.allowHeader = false;
        this.allowFooter = false;
    }

    pageChange(delta: number): void {
        let state: AppState = store.getState();
        S.srch.showFollowing(delta === 0 ? 0 : this.data.rsInfo.page + delta,
            this.data.rsInfo.showingFollowingOfUser);
    }

    renderHeading(): CompIntf {
        return new Heading(4, "Following (@" + this.data.rsInfo.showingFollowingOfUser + ")", { className: "resultsTitle" });
    }
}
