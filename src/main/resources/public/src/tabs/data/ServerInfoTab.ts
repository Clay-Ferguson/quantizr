import { getAs } from "../../AppContext";
import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { OpenGraphPanel } from "../../comp/OpenGraphPanel";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import { NodeInfo } from "../../JavaIntf";
import { ServerInfoView } from "../ServerInfoView";

export class ServerInfoTab implements TabIntf<any> {
    name = "Info View";
    tooltip = "Displaying the information view for the most recently requested info";
    id = C.TAB_SERVERINFO;
    scrollPos = 0;
    props = {};
    openGraphComps: OpenGraphPanel[] = [];
    topmostVisibleElmId: string = null;

    static inst: ServerInfoTab = null;
    constructor() {
        ServerInfoTab.inst = this;
    }

    isVisible = () => {
        return !!getAs().serverInfoText;
    };

    constructView = (data: TabIntf) => new ServerInfoView(data);
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
