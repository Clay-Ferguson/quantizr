import { getAs } from "../../AppContext";
import { AppState } from "../../AppState";
import { Constants as C } from "../../Constants";
import { TabBase } from "../../intf/TabBase";
import { NodeInfo } from "../../JavaIntf";
import { S } from "../../Singletons";
import { ThreadRSInfo } from "../../ThreadRSInfo";
import { ThreadView } from "../ThreadView";

export class ThreadTab extends TabBase<ThreadRSInfo> {
    name = "Thread";
    tooltip = "View of Posts in top-down chronological order showing the full reply chain"
    id = C.TAB_THREAD;
    props = new ThreadRSInfo();
    static inst: ThreadTab = null;
    static URL_PARAM = "thread";

    constructor() {
        super();
        ThreadTab.inst = this;
    }

    isVisible() {
        return !!getAs().threadViewFromNodeId;
    }

    static selectIfOpened(): boolean {
        if (ThreadTab.inst.isVisible()) {
            S.tabUtil.selectTab(C.TAB_THREAD);
            return true;
        }
        return false;
    }

    constructView(data: TabBase<ThreadRSInfo>): ThreadView<ThreadRSInfo> {
        return new ThreadView(data);
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
