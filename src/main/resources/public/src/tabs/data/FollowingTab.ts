import { AppState } from "../../AppState";
import { Constants as C } from "../../Constants";
import { FollowingRSInfo } from "../../FollowingRSInfo";
import { TabBase } from "../../intf/TabBase";
import { NodeInfo } from "../../JavaIntf";
import { S } from "../../Singletons";
import { FollowingResultSetView } from "../FollowingResultSetView";

export class FollowingTab extends TabBase<FollowingRSInfo> {
    name = "Following";
    tooltip = "List of people the person is following";
    id = C.TAB_FOLLOWING;
    props = new FollowingRSInfo();

    static inst: FollowingTab = null;
    constructor() {
        super();
        FollowingTab.inst = this;
    }

    isVisible() {
        return S.tabUtil.resultSetHasData(C.TAB_FOLLOWING);
    }
    constructView(ast: TabBase<FollowingRSInfo>): FollowingResultSetView<FollowingRSInfo> {
        return new FollowingResultSetView<FollowingRSInfo>(ast);
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
