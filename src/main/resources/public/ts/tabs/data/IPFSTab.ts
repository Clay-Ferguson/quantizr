import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { OpenGraphPanel } from "../../comp/OpenGraphPanel";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import * as J from "../../JavaIntf";
import { ValidatedState } from "../../ValidatedState";
import { IPFSFilesView } from "../IPFSFilesView";
import { IPFSFilesViewProps } from "../IPFSFilesViewProps";

export class IPFSTab implements TabIntf<any> {
    name = "IPFS Explorer";
    tooltip = "Explorer for IPFS content and folders";
    id = C.TAB_IPFSVIEW;
    scrollPos = 0;
    props = {
        cidField: new ValidatedState()
    };

    openGraphComps: OpenGraphPanel[] = [];

    static inst: IPFSTab = null;
    constructor() {
        IPFSTab.inst = this;
    }

    isVisible = (state: AppState) => {
        // This flag can now be turned on in the tools menu, and stays on. Doesn't persiste like profile setting [yet]
        // return state.showIpfsTab;
        return state.userProfile?.mfsEnable && state.allowedFeatures && state.allowedFeatures.indexOf("web3") !== -1;
    };

    constructView = (data: TabIntf<IPFSFilesViewProps>) => new IPFSFilesView(data);
    getTabSubOptions = (state: AppState): Div => { return null; };

    findNode = (state: AppState, nodeId: string): J.NodeInfo => {
        return null;
    }

    nodeDeleted = (state: AppState, nodeId: string): void => {
    }

    replaceNode = (state: AppState, newNode: J.NodeInfo): void => {
    }   
}
