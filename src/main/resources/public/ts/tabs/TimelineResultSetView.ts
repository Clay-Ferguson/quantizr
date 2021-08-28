import { store } from "../AppRedux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { TabDataIntf } from "../intf/TabDataIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { TimelineRSInfo } from "../TimelineRSInfo";
import { ResultSetView } from "./ResultSetView";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class TimelineResultSetView<I extends TimelineRSInfo> extends ResultSetView {

    constructor(state: AppState, data: TabDataIntf) {
        super(state, data);
        data.inst = this;
    }

    pageChange(delta: number): void {
        let state: AppState = store.getState();

        S.srch.timeline(this.data.rsInfo.node, this.data.rsInfo.prop, state, this.data.rsInfo.timeRangeType,
            this.data.rsInfo.description,
            delta === 0 ? 0 : this.data.rsInfo.page + delta, this.data.rsInfo.recursive);
    }
}
