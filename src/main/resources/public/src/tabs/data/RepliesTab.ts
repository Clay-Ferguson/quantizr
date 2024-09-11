import { getAs } from "../../AppContext";
import { AppState } from "../../AppState";
import { Constants as C } from "../../Constants";
import { NodeInfo } from "../../JavaIntf";
import { RepliesRSInfo } from "../../RepliesRSInfo";
import { S } from "../../Singletons";
import { TabBase } from "../../intf/TabBase";
import { RepliesView } from "../RepliesView";

export class RepliesTab extends TabBase<RepliesRSInfo> {
    name = "Replies";
    tooltip = "All known replies to the post"
    id = C.TAB_REPLIES;
    props = new RepliesRSInfo();

    static inst: RepliesTab = null;
    constructor() {
        super();
        RepliesTab.inst = this;
    }

    isVisible() { return !!getAs().repliesViewNodeId; };
    constructView(data: TabBase) {
        return new RepliesView(data);
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
