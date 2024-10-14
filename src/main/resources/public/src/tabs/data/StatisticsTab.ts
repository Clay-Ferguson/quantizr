import { getAs } from "../../AppContext";
import { AppState } from "../../AppState";
import { Constants as C } from "../../Constants";
import { TabBase } from "../../intf/TabBase";
import { NodeInfo } from "../../JavaIntf";
import { S } from "../../Singletons";
import { StatisticsRSInfo } from "../../StatisticsRSInfo";
import { StatisticsView } from "../StatisticsView";

export class StatisticsTab extends TabBase<StatisticsRSInfo> {
    name = "Node Stats";
    tooltip = "Statistics about the node and its children";
    id = C.TAB_TRENDING;
    props = new StatisticsRSInfo();
    static inst: StatisticsTab = null;
    static URL_PARAM = "trending"; // todo-0: rename to 'stats'

    constructor() {
        super();
        StatisticsTab.inst = this;
    }

    isVisible() {
        return getAs().statsNodeId !== null;
    }

    static selectIfOpened(): boolean {
        if (StatisticsTab.inst.isVisible()) {
            S.tabUtil.selectTab(C.TAB_TRENDING);
            return true;
        }
        return false;
    }

    constructView(data: TabBase) {
        return new StatisticsView(data);
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
