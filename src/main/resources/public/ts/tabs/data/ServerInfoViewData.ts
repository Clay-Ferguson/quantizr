import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { OpenGraphPanel } from "../../comp/OpenGraphPanel";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import { ServerInfoView } from "../ServerInfoView";
import * as J from "../../JavaIntf";

export class ServerInfoViewData implements TabIntf<any> {
    name = "Info View";
    tooltip = "Displaying the information view for the most recently requested info";
    id = C.TAB_SERVERINFO;
    scrollPos = 0;
    props = {};
    openGraphComps: OpenGraphPanel[] = [];

    static inst: ServerInfoViewData = null;
    constructor() {
        ServerInfoViewData.inst = this;
    }

    isVisible = (state: AppState) => {
        return !!state.serverInfoText;
    };

    constructView = (data: TabIntf) => new ServerInfoView(data);
    getTabSubOptions = (state: AppState): Div => { return null; };

    findNode = (nodeId: string): J.NodeInfo => {
        return null;
    }

    nodeDeleted = (nodeId: string): void => {
    }
}
