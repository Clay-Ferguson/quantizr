import { store } from "../../AppRedux";
import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import { MFSFilesView } from "../MFSFilesView";
import { MFSFilesViewProps } from "../MFSFilesViewProps";

export class MFSViewData implements TabIntf {
    name = "Web3 Files";
    id = C.TAB_MFSFILES;
    rsInfo = null;
    scrollPos = 0;
    props = {};
    openGraphComps = [];

    isVisible = () => {
        let state: AppState = store.getState();
        return state.userProfile?.mfsEnable && state.allowedFeatures && state.allowedFeatures.indexOf("web3") !== -1;
    };

    // AppTab-derived class
    constructView = (data: TabIntf<MFSFilesViewProps>) => new MFSFilesView(data);
    getTabSubOptions = (state: AppState): Div => { return null; };
}
