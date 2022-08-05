import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { OpenGraphPanel } from "../../comp/OpenGraphPanel";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import { ThreadRSInfo } from "../../ThreadRSInfo";
import { ThreadView } from "../ThreadView";

export class ThreadViewData implements TabIntf {
    name = "Thread";
    tooltip = "View of Posts in top-down chronological order showing the full reply chain"
    id = C.TAB_THREAD;
    rsInfo = new ThreadRSInfo();
    scrollPos = 0;
    props = {};
    openGraphComps: OpenGraphPanel[] = [];

    isVisible = (state: AppState) => { return !!state.threadViewNodeId; };

    constructView = (data: TabIntf) => new ThreadView(data);
    getTabSubOptions = (state: AppState): Div => { return null; };
}
