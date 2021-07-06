import { store } from "../AppRedux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { TabDataIntf } from "../intf/TabDataIntf";
import { PubSub } from "../PubSub";
import { SharesRSInfo } from "../SharesRSInfo";
import { Singletons } from "../Singletons";
import { ResultSetView } from "./ResultSetView";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class SharedNodesResultSetView<I extends SharesRSInfo> extends ResultSetView {

    constructor(state: AppState, data: TabDataIntf) {
        super(state, data);
        data.inst = this;
    }

    pageChange(delta: number): void {
        let state: AppState = store.getState();
        let info = this.data.rsInfo as I;

        S.srch.findSharedNodes(info.node,
            delta === 0 ? 0 : info.page + delta,
            info.shareNodesType,
            info.shareTarget,
            info.accessOption,
            state);
    }
}
