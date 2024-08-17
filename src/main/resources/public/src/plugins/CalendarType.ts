import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { TabIntf } from "../intf/TabIntf";
import { NodeActionType } from "../intf/TypeIntf";
import * as J from "../JavaIntf";
import { NodeInfo } from "../JavaIntf";
import { S } from "../Singletons";
import { TypeBase } from "./base/TypeBase";

export class CalendarType extends TypeBase {
    constructor() {
        super(J.NodeType.CALENDAR, "Calendar", "fa-calendar", true);
    }

    override allowAction(_action: NodeActionType, _node: NodeInfo): boolean {
        return true;
    }

    // @ts-ignore
    super_render = this.render;
    override render = (node: NodeInfo, tabData: TabIntf<any>, rowStyling: boolean, isTreeView: boolean): Comp => {
        const baseComp = this.super_render(node, tabData, rowStyling, isTreeView);
        return new Div(null, null, [
            baseComp,
            new ButtonBar([
                new Button("Past", () => {
                    S.srch.timeline(node?.id, J.NodeProp.DATE_FULL, "pastOnly", "Past calendar dates (Newest at the top)", 0, true);
                }, null),
                new Button("Past Due", () => {
                    S.srch.timeline(node?.id, J.NodeProp.DATE_FULL, "pastDue", "Past Due calendar dates (Newest at the top)", 0, true);
                }, null),
                new Button("Future", () => {
                    S.srch.timeline(node?.id, J.NodeProp.DATE_FULL, "futureOnly", "Future calendar dates (Soonest at the top)", 0, true);
                }, null),
                new Button("Today", () => {
                    S.srch.timeline(node?.id, J.NodeProp.DATE_FULL, "today", "Today's calendar dates", 0, true);
                }, null),
                new Button("All", () => {
                    S.srch.timeline(node?.id, J.NodeProp.DATE_FULL, "all", "All calendar dates (Latest/Future at the top)", 0, true);
                }, null),
                new Button("Calendar", () => {
                    S.render.showCalendar(node.id);
                }, null)
            ], "marginLeft marginBottom")
        ]);
    }
}
