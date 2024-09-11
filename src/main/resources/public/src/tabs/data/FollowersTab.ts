import { AppState } from "../../AppState";
import { Constants as C } from "../../Constants";
import { FollowersRSInfo } from "../../FollowersRSInfo";
import { TabBase } from "../../intf/TabBase";
import { NodeInfo } from "../../JavaIntf";
import { S } from "../../Singletons";
import { FollowersResultSetView } from "../FollowersResultSetView";

export class FollowersTab extends TabBase<FollowersRSInfo> {
    name = "Followers";
    tooltip = "Followers of your account";
    id = C.TAB_FOLLOWERS;
    props = new FollowersRSInfo();

    static inst: FollowersTab = null;
    constructor() {
        super();
        FollowersTab.inst = this;
    }

    isVisible() {
        return S.tabUtil.resultSetHasData(C.TAB_FOLLOWERS);
    }
    constructView(data: TabBase) {
        return new FollowersResultSetView<FollowersRSInfo>(data);
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
