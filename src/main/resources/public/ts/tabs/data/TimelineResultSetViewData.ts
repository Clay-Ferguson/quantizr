import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { OpenGraphPanel } from "../../comp/OpenGraphPanel";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import * as J from "../../JavaIntf";
import { S } from "../../Singletons";
import { TimelineRSInfo } from "../../TimelineRSInfo";
import { TimelineResultSetView } from "../TimelineResultSetView";
export class TimelineResultSetViewData implements TabIntf<TimelineRSInfo> {
    name = "Timeline";
    tooltip = "Reverse-chronological list of the entire subgraph of all nodes under one node"
    id = C.TAB_TIMELINE;
    props = new TimelineRSInfo();
    scrollPos = 0;
    openGraphComps: OpenGraphPanel[] = [];

    static inst: TimelineResultSetViewData = null;
    constructor() {
        TimelineResultSetViewData.inst = this;
    }

    isVisible = (state: AppState) => S.tabUtil.resultSetHasData(C.TAB_TIMELINE);
    constructView = (data: TabIntf) => new TimelineResultSetView<TimelineRSInfo>(data);
    getTabSubOptions = (state: AppState): Div => { return null; };

    findNode = (state: AppState, nodeId: string): J.NodeInfo => {
        return this.props.results?.find(n => n.id === nodeId);
    }

    nodeDeleted = (state: AppState, nodeId: string): void => {
        this.props.results = this.props.results?.filter(n => nodeId !== n.id);
    }

    replaceNode = (state: AppState, newNode: J.NodeInfo): void => {
        this.props.results = this.props.results?.map(n => {
            return n.id === newNode.id ? newNode : n;
        });
    }
}
