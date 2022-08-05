import { getAppState } from "../AppRedux";
import { TabIntf } from "../intf/TabIntf";
import { S } from "../Singletons";
import { TimelineRSInfo } from "../TimelineRSInfo";
import { ResultSetView } from "./ResultSetView";

export class TimelineResultSetView<T extends TimelineRSInfo> extends ResultSetView<T> {

    constructor(data: TabIntf) {
        super(data);
        data.inst = this;
    }

    pageChange(delta: number): void {
        const state = getAppState();

        let page = this.data.props.page;
        if (delta !== null) {
            page = delta === 0 ? 0 : this.data.props.page + delta;
        }

        S.srch.timeline(this.data.props.node, this.data.props.prop, state, this.data.props.timeRangeType,
            this.data.props.description,
            page, this.data.props.recursive);
    }
}
