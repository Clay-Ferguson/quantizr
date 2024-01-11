import { dispatch, getAs } from "../AppContext";
import { Comp } from "../comp/base/Comp";
import { Checkbox } from "../comp/core/Checkbox";
import { TabIntf } from "../intf/TabIntf";
import { S } from "../Singletons";
import { TimelineRSInfo } from "../TimelineRSInfo";
import { ResultSetView } from "./ResultSetView";

export class TimelineResultSetView<PT extends TimelineRSInfo> extends ResultSetView<PT, TimelineResultSetView<PT>> {

    constructor(data: TabIntf<PT, TimelineResultSetView<PT>>) {
        super(data);
        data.inst = this;
    }

    override pageChange(delta: number): void {
        let page = this.data.props.page;
        if (delta !== null) {
            page = delta === 0 ? 0 : this.data.props.page + delta;
        }

        S.srch.timeline(this.data.props.node?.id, this.data.props.prop, this.data.props.timeRangeType,
            this.data.props.description,
            page, this.data.props.recursive);
    }

    override extraPagingComps = (): Comp[] => {
        return [new Checkbox("Live Updates", { className: "bigMarginLeft" }, {
            setValue: (checked: boolean) => {
                // dispatch now for rapid screen refresh
                dispatch("AutoRefresh", (s) => {
                    s.userPrefs.autoRefreshFeed = checked;
                });
                // save to server now
                S.edit.setAutoRefreshFeed(checked);
            },
            getValue: (): boolean => getAs().userPrefs.autoRefreshFeed
        })];
    }

    override getFloatRightHeaderComp = (): Comp => {
        return null;
    }
}
