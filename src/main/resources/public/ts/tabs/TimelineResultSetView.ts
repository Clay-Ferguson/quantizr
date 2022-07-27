import { getAppState } from "../AppRedux";
import { TabIntf } from "../intf/TabIntf";
import { S } from "../Singletons";
import { TimelineRSInfo } from "../TimelineRSInfo";
import { ResultSetView } from "./ResultSetView";

export class TimelineResultSetView<I extends TimelineRSInfo> extends ResultSetView {

    constructor(data: TabIntf) {
        super(data);
        data.inst = this;
    }

    pageChange(delta: number): void {
        let state = getAppState();

        let page = this.data.rsInfo.page;
        if (delta !== null) {
            page = delta === 0 ? 0 : this.data.rsInfo.page + delta;
        }

        S.srch.timeline(this.data.rsInfo.node, this.data.rsInfo.prop, state, this.data.rsInfo.timeRangeType,
            this.data.rsInfo.description,
            page, this.data.rsInfo.recursive);
    }
}
