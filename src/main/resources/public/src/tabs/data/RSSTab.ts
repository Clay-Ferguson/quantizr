import { getAs } from "../../AppContext";
import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { OpenGraphPanel } from "../../comp/OpenGraphPanel";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import { NodeInfo } from "../../JavaIntf";
import { RSSView } from "../RSSView";

export class RSSTab implements TabIntf<any> {
    name = "RSS Feed";
    tooltip = "Get some news or podcasts";
    id = C.TAB_RSS;
    scrollPos = 0;
    props = {};
    openGraphComps: OpenGraphPanel[] = [];
    topmostVisibleElmId: string = null;
    static inst: RSSTab = null;

    constructor() {
        RSSTab.inst = this;
    }

    isVisible = () => {
        return !!getAs().rssNode;
    }

    constructView = (data: TabIntf) => new RSSView(data);
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
