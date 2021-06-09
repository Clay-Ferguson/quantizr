import { store } from "../AppRedux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { TabDataIntf } from "../intf/TabDataIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
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
        S.srch.showFollowers(delta === 0 ? 0 : this.data.rsInfo.page + delta);
    }
}
