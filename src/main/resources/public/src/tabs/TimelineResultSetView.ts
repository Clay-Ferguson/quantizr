import { dispatch, getAs } from "../AppContext";
import { S } from "../Singletons";
import { TimelineRSInfo } from "../TimelineRSInfo";
import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { Checkbox } from "../comp/core/Checkbox";
import { Selection } from "../comp/core/Selection";
import { TabBase } from "../intf/TabBase";
import { ResultSetView } from "./ResultSetView";

export class TimelineResultSetView<PT extends TimelineRSInfo> extends ResultSetView<PT, TimelineResultSetView<PT>> {

    constructor(data: TabBase<PT, TimelineResultSetView<PT>>) {
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

    override extraPagingComps(): Comp[] {
        return [
            new Checkbox("Live", { className: "bigMarginLeft" }, {
                setValue: (checked: boolean) => {
                    // dispatch now for rapid screen refresh
                    dispatch("AutoRefresh", (s) => {
                        s.userPrefs.autoRefreshFeed = checked;
                    });
                    // save to server now
                    S.edit.setAutoRefreshFeed(checked);
                },
                getValue: (): boolean => getAs().userPrefs.autoRefreshFeed
            }),
            new Selection(null, null, [
                { key: "true", val: "Chronological" },
                { key: "false", val: "Rev. Chron" },
            ],
                null, "timelineChronoOrder", {
                setValue: (val: string) => {
                    dispatch("TimelineReversedOrder", (s) => {
                        s.timelineReversedOrder = val === "true";
                    });
                },
                getValue: (): string => getAs().timelineReversedOrder ? "true" : "false"
            }),
        ];
    }

    override getFloatRightHeaderComp(): Comp {
        return new Button("Post", S.edit._postFromTimeline, null, "tw-float-right -primary marginRight")
    }
}
