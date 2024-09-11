import { getAs } from "../../AppContext";
import { AppState } from "../../AppState";
import { Constants as C } from "../../Constants";
import { TabBase } from "../../intf/TabBase";
import { NodeInfo } from "../../JavaIntf";
import { S } from "../../Singletons";
import { TrendingRSInfo } from "../../TrendingRSInfo";
import { TrendingView } from "../TrendingView";

export class TrendingTab extends TabBase<TrendingRSInfo> {
    name = "Node Stats";
    tooltip = "Statistics about the node and its children";
    id = C.TAB_TRENDING;
    props = new TrendingRSInfo();
    static inst: TrendingTab = null;
    
    constructor() {
        super();
        TrendingTab.inst = this;
    }

    isVisible() {
        return getAs().statsNodeId !== null;
    }
    constructView(data: TabBase) {
        return new TrendingView(data);
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
