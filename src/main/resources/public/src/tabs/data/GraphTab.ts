import { dispatch } from "../../AppContext";
import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { FullScreenGraphViewer } from "../../comp/FullScreenGraphViewer";
import { OpenGraphPanel } from "../../comp/OpenGraphPanel";
import { Constants as C } from "../../Constants";
import { FullScreenType } from "../../Interfaces";
import { TabIntf } from "../../intf/TabIntf";
import { NodeInfo } from "../../JavaIntf";

export class GraphTab implements TabIntf<any> {
    name = "Node Graph";
    tooltip = "View Node Graph";
    id = C.TAB_GRAPH;
    props = {};
    scrollPos = 0;
    openGraphComps: OpenGraphPanel[] = [];
    topmostVisibleElmId: string = null;

    static inst: GraphTab = null;
    constructor() {
        GraphTab.inst = this;
    }

    isVisible = () => {
        return FullScreenGraphViewer.div;
    }

    constructView = (_data: TabIntf) => {
        dispatch("RestoreGraph", s => {
            s.savedActiveTab = s.activeTab;
            s.fullScreenConfig = { type: FullScreenType.GRAPH };
        });
        return null;
    }

    getTabSubOptions = (): Div => { return null; };

    findNode = (_nodeId: string): NodeInfo => {
        return null;
    }

    findNodeByPath = (_path: string): NodeInfo => {
        return null;
    }

    nodeDeleted = (_ust: AppState, _nodeId: string): void => {
    }

    replaceNode = (_ust: AppState, _newNode: NodeInfo): void => {
    }

    processNode = (_ust: AppState, _func: (node: NodeInfo) => void): void => {
    }
}
