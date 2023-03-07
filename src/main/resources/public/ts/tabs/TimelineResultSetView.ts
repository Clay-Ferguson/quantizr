import { Comp } from "../comp/base/Comp";
import { TabIntf } from "../intf/TabIntf";
import { S } from "../Singletons";
import { TimelineRSInfo } from "../TimelineRSInfo";
import { ResultSetView } from "./ResultSetView";

export class TimelineResultSetView<PT extends TimelineRSInfo> extends ResultSetView<PT, TimelineResultSetView<PT>> {

    constructor(data: TabIntf<PT, TimelineResultSetView<PT>>) {
        super(data);
        data.inst = this;
    }

    pageChange(delta: number): void {
        let page = this.data.props.page;
        if (delta !== null) {
            page = delta === 0 ? 0 : this.data.props.page + delta;
        }

        S.srch.timeline(this.data.props.node, this.data.props.prop, this.data.props.timeRangeType,
            this.data.props.description,
            page, this.data.props.recursive);
    }

    extraPagingComps = (): Comp[] => {
        return null;
    }

    getFloatRightHeaderComp = (): Comp => {
        return null;
    }
}
