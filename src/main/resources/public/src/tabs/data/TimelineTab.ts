import { AppState } from "../../AppState";
import { Constants as C } from "../../Constants";
import { TabBase } from "../../intf/TabBase";
import { NodeInfo } from "../../JavaIntf";
import { S } from "../../Singletons";
import { TimelineRSInfo } from "../../TimelineRSInfo";
import { TimelineResultSetView } from "../TimelineResultSetView";

export class TimelineTab extends TabBase<TimelineRSInfo> {
    name = "Timeline";
    tooltip = "Reverse-chronological list of the entire subgraph of all nodes under one node"
    id = C.TAB_TIMELINE;
    props = new TimelineRSInfo();
    static inst: TimelineTab = null;
    
    constructor() {
        super();
        TimelineTab.inst = this;
    }

    isVisible() {
        return S.tabUtil.resultSetHasData(C.TAB_TIMELINE);
    }
    constructView(data: TabBase) {
        return new TimelineResultSetView<TimelineRSInfo>(data);
    }

    findNode(nodeId: string): NodeInfo {
        return S.util.searchNodeArray(this.props.results, nodeId);
    }

    nodeDeleted(_ust: AppState, nodeId: string): void {
        this.props.results = this.props.results?.filter(n => nodeId !== n.id);
    }

    replaceNode(_ust: AppState, newNode: NodeInfo): void {
        this.props.results = this.props.results?.map(n => {
            return n?.id === newNode?.id ? newNode : n;
        });
    }

    processNode(_ust: AppState, func: (node: NodeInfo) => void): void {
        this.props.results?.forEach(n => func(n));
    }
}
