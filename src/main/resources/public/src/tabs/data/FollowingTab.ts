import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { OpenGraphPanel } from "../../comp/OpenGraphPanel";
import { Constants as C } from "../../Constants";
import { FollowingRSInfo } from "../../FollowingRSInfo";
import { TabIntf } from "../../intf/TabIntf";
import { NodeInfo } from "../../JavaIntf";
import { S } from "../../Singletons";
import { FollowingResultSetView } from "../FollowingResultSetView";

export class FollowingTab implements TabIntf<FollowingRSInfo> {
    name = "Following";
    tooltip = "List of people the person is following";
    id = C.TAB_FOLLOWING;
    props = new FollowingRSInfo();
    scrollPos = 0;
    openGraphComps: OpenGraphPanel[] = [];
    topmostVisibleElmId: string = null;

    static inst: FollowingTab = null;
    constructor() {
        FollowingTab.inst = this;
    }

    isVisible = () => S.tabUtil.resultSetHasData(C.TAB_FOLLOWING);
    constructView = (ast: TabIntf) => new FollowingResultSetView<FollowingRSInfo>(ast);
    getTabSubOptions = (): Div => { return null; };

    findNode = (nodeId: string): NodeInfo => {
        return S.util.searchNodeArray(this.props.results, nodeId);
    }

    findNodeByPath = (_path: string): NodeInfo => {
        return null;
    }

    nodeDeleted = (_ust: AppState, nodeId: string): void => {
        this.props.results = this.props.results?.filter(n => nodeId !== n.id);
    }

    replaceNode = (_ust: AppState, newNode: NodeInfo): void => {
        this.props.results = this.props.results?.map(n => {
            return n?.id === newNode?.id ? newNode : n;
        });
    }

    processNode = (_ust: AppState, func: (node: NodeInfo) => void): void => {
        this.props.results?.forEach(n => func(n));
    }
}
