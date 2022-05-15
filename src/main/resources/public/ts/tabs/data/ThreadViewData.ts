import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import { ThreadRSInfo } from "../../ThreadRSInfo";
import { ThreadView } from "../ThreadView";

export class ThreadViewData implements TabIntf {
    name = "Thread";
    id = C.TAB_THREAD;
    rsInfo = new ThreadRSInfo();
    scrollPos = 0;
    props = {};
    openGraphComps = [];

    isVisible = (state: AppState) => { return !!state.threadViewNodeId; };

    constructView = (data: TabIntf) => new ThreadView(data);
    getTabSubOptions = (state: AppState): Div => { return null; };
}
