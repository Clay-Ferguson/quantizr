import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { OpenGraphPanel } from "../../comp/OpenGraphPanel";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import { S } from "../../Singletons";
import { TimelineRSInfo } from "../../TimelineRSInfo";
import { TimelineResultSetView } from "../TimelineResultSetView";

export class TimelineResultSetViewData implements TabIntf {
    name = "Timeline";
    tooltip = "Reverse-chronological list of the entire subgraph of all nodes under one node"
    id = C.TAB_TIMELINE;
    rsInfo = new TimelineRSInfo();
    scrollPos = 0;
    props = {};
    openGraphComps: OpenGraphPanel[] = [];

    isVisible = (state: AppState) => S.tabUtil.resultSetHasData(C.TAB_TIMELINE);
    constructView = (data: TabIntf) => new TimelineResultSetView<TimelineRSInfo>(data);
    getTabSubOptions = (state: AppState): Div => { return null; };
}
