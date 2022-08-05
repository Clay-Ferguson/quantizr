import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { OpenGraphPanel } from "../../comp/OpenGraphPanel";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import { ServerInfoView } from "../ServerInfoView";

export class ServerInfoViewData implements TabIntf {
    name = "Info View";
    tooltip = "Displaying the information view for the most recently requested info";
    id = C.TAB_SERVERINFO;
    rsInfo = null as any; // todo-0: why as any
    scrollPos = 0;
    props = {};
    openGraphComps: OpenGraphPanel[] = [];

    isVisible = (state: AppState) => {
        return !!state.serverInfoText;
    };

    constructView = (data: TabIntf) => new ServerInfoView(data);
    getTabSubOptions = (state: AppState): Div => { return null; };
}
