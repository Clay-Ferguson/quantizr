import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { Constants as C } from "../../Constants";
import { TabBase } from "../../intf/TabBase";
import { NodeInfo } from "../../JavaIntf";
import { SharesRSInfo } from "../../SharesRSInfo";
import { S } from "../../Singletons";
import { SharedNodesResultSetView } from "../SharedNodesResultSetView";

export class SharesTab extends TabBase<SharesRSInfo> {
    name = "My Shared Nodes";
    tooltip = "Shows all the Shared nodes made accessible to other users";
    id = C.TAB_SHARES;
    isVisible = () => S.tabUtil.resultSetHasData(C.TAB_SHARES);
    constructView = (data: TabBase<SharesRSInfo>) => new SharedNodesResultSetView<SharesRSInfo>(data);
    getTabSubOptions = (): Div => { return null; };
    props = new SharesRSInfo();
    static inst: SharesTab = null;

    constructor() {
        super();
        SharesTab.inst = this;
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
