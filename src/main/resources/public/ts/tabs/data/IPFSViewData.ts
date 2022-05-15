import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import { ValidatedState } from "../../ValidatedState";
import { IPFSFilesView } from "../IPFSFilesView";
import { IPFSFilesViewProps } from "../IPFSFilesViewProps";

export class IPFSViewData implements TabIntf {
    name = "IPFS Explorer";
    id = C.TAB_IPFSVIEW;
    rsInfo = null;
    scrollPos = 0;
    props = {
        cidField: new ValidatedState<any>()
    };

    openGraphComps = [];

    isVisible = (state: AppState) => {
        // This flag can now be turned on in the tools menu, and stays on. Doesn't persiste like profile setting [yet]
        return state.showIpfsTab;
        // return state.userProfile?.mfsEnable && state.allowedFeatures && state.allowedFeatures.indexOf("web3") !== -1;
    };

    constructView = (data: TabIntf<IPFSFilesViewProps>) => new IPFSFilesView(data);
    getTabSubOptions = (state: AppState): Div => { return null; };
}
