import { store } from "../../AppRedux";
import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import { ServerInfoView } from "../ServerInfoView";

export class ServerInfoViewData implements TabIntf {
    name = "Server Info";
    id = C.TAB_SERVERINFO;
    rsInfo = null;
    scrollPos = 0;
    props = {};
    openGraphComps = [];

    isVisible = () => {
        let state: AppState = store.getState();
        return !!state.serverInfoText;
    };

    constructView = (data: TabIntf) => new ServerInfoView(data);
    getTabSubOptions = (state: AppState): Div => { return null; };
}
