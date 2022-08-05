import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { OpenGraphPanel } from "../../comp/OpenGraphPanel";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import { ValidatedState } from "../../ValidatedState";
import { IPFSFilesView } from "../IPFSFilesView";
import { IPFSFilesViewProps } from "../IPFSFilesViewProps";
import * as J from "../../JavaIntf";

export class IPFSViewData implements TabIntf<any> {
    name = "IPFS Explorer";
    tooltip = "Explorer for IPFS content and folders";
    id = C.TAB_IPFSVIEW;
    scrollPos = 0;
    props = {
        cidField: new ValidatedState<any>()
    };

    openGraphComps: OpenGraphPanel[] = [];

    static inst: IPFSViewData = null;
    constructor() {
        IPFSViewData.inst = this;
    }

    isVisible = (state: AppState) => {
        // This flag can now be turned on in the tools menu, and stays on. Doesn't persiste like profile setting [yet]
        // return state.showIpfsTab;
        return state.userProfile?.mfsEnable && state.allowedFeatures && state.allowedFeatures.indexOf("web3") !== -1;
    };

    constructView = (data: TabIntf<IPFSFilesViewProps>) => new IPFSFilesView(data);
    getTabSubOptions = (state: AppState): Div => { return null; };

    findNode = (nodeId: string): J.NodeInfo => {
        return null;
    }

    nodeDeleted = (nodeId: string): void => {
    }
}
