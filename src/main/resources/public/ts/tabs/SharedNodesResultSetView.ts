import { getAppState } from "../AppRedux";
import { TabIntf } from "../intf/TabIntf";
import { SharesRSInfo } from "../SharesRSInfo";
import { S } from "../Singletons";
import { ResultSetView } from "./ResultSetView";

export class SharedNodesResultSetView<I extends SharesRSInfo> extends ResultSetView {

    constructor(data: TabIntf) {
        super(data);
        data.inst = this;
        this.showContentHeading = false;
    }

    pageChange(delta: number): void {
        const state = getAppState();
        const info = this.data.rsInfo as I;

        let page = info.page;
        if (delta !== null) {
            page = delta === 0 ? 0 : info.page + delta;
        }

        S.srch.findSharedNodes(info.node,
            page,
            info.shareNodesType,
            info.shareTarget,
            info.accessOption,
            state);
    }
}
