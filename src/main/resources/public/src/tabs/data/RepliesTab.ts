import { getAs } from "../../AppContext";
import { AppState } from "../../AppState";
import { Constants as C } from "../../Constants";
import { NodeInfo } from "../../JavaIntf";
import { RepliesRSInfo } from "../../RepliesRSInfo";
import { S } from "../../Singletons";
import { OpenGraphPanel } from "../../comp/OpenGraphPanel";
import { Div } from "../../comp/core/Div";
import { TabIntf } from "../../intf/TabIntf";
import { RepliesView } from "../RepliesView";

export class RepliesTab implements TabIntf<RepliesRSInfo> {
    name = "Replies";
    tooltip = "All known replies to the post"
    id = C.TAB_REPLIES;
    props = new RepliesRSInfo();
    scrollPos = 0;
    openGraphComps: OpenGraphPanel[] = [];
    topmostVisibleElmId: string = null;

    static inst: RepliesTab = null;
    constructor() {
        RepliesTab.inst = this;
    }

    isVisible = () => { return !!getAs().repliesViewNodeId; };
    constructView = (data: TabIntf) => new RepliesView(data);
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
