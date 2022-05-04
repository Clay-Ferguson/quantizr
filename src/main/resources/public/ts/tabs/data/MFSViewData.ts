import { store } from "../../AppRedux";
import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import { MFSFilesView } from "../MFSFilesView";
import { MFSFilesViewProps } from "../MFSFilesViewProps";

export class MFSViewData implements TabIntf {
    name = "MFS Files";
    id = C.TAB_MFSFILES;
    rsInfo = null;
    scrollPos = 0;
    props = {};
    openGraphComps = [];

    isVisible = () => {
        let state: AppState = store.getState();
        // return !!state.serverInfoText;
        return true; // make this correct (todo-0)
    };

    // AppTab-derived class
    constructView = (data: TabIntf<MFSFilesViewProps>) => new MFSFilesView(data);
    getTabSubOptions = (state: AppState): Div => { return null; };
}
