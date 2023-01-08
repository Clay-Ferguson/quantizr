import { getAppState } from "../AppContext";
import { Comp } from "../comp/base/Comp";
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
        const ast = getAppState();
        let page = this.data.props.page;
        if (delta !== null) {
            page = delta === 0 ? 0 : this.data.props.page + delta;
        }

        S.srch.timeline(this.data.props.node, this.data.props.prop, ast, this.data.props.timeRangeType,
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
