import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { OpenGraphPanel } from "../../comp/OpenGraphPanel";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import { ThreadRSInfo } from "../../ThreadRSInfo";
import { ThreadView } from "../ThreadView";
import * as J from "../../JavaIntf";

export class ThreadViewData implements TabIntf<ThreadRSInfo> {
    name = "Thread";
    tooltip = "View of Posts in top-down chronological order showing the full reply chain"
    id = C.TAB_THREAD;
    props = new ThreadRSInfo();
    scrollPos = 0;
    openGraphComps: OpenGraphPanel[] = [];

    static inst: ThreadViewData = null;
    constructor() {
        ThreadViewData.inst = this;
    }

    isVisible = (state: AppState) => { return !!state.threadViewNodeId; };

    constructView = (data: TabIntf) => new ThreadView(data);
    getTabSubOptions = (state: AppState): Div => { return null; };

    findNode = (nodeId: string): J.NodeInfo => {
        return this.props.results.find(n => n.id === nodeId);
    }

    nodeDeleted = (nodeId: string): void => {
        this.props.results = this.props.results.filter(n => nodeId !== n.id);
    }
}
