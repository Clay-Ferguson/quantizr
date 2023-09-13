import { getAs } from "../../AppContext";
import { AppState } from "../../AppState";
import { Constants as C } from "../../Constants";
import * as J from "../../JavaIntf";
import { S } from "../../Singletons";
import { Validator } from "../../Validator";
import { OpenGraphPanel } from "../../comp/OpenGraphPanel";
import { Div } from "../../comp/core/Div";
import { TabIntf } from "../../intf/TabIntf";
import { IPFSFilesView } from "../IPFSFilesView";
import { IPFSFilesViewProps } from "../IPFSFilesViewProps";

export class IPFSTab implements TabIntf<any> {
    name = "IPFS Explorer";
    tooltip = "Explorer for IPFS content and folders";
    id = C.TAB_IPFSVIEW;
    scrollPos = 0;
    props = {
        cidField: new Validator()
    };

    openGraphComps: OpenGraphPanel[] = [];
    topmostVisibleElmId: string = null;

    static inst: IPFSTab = null;
    constructor() {
        IPFSTab.inst = this;
    }

    isVisible = () => {
        const ast = getAs();
        // This flag can now be turned on in the tools menu, and stays on. Doesn't persiste like profile setting [yet]
        // return state.showIpfsTab;
        return S.quanta.cfg.ipfsEnabled && ast.userProfile?.mfsEnable && ast.allowedFeatures?.indexOf("web3") !== -1;
    };

    constructView = (data: TabIntf<IPFSFilesViewProps>) => new IPFSFilesView(data);
    getTabSubOptions = (): Div => { return null; };

    findNode = (_nodeId: string): J.NodeInfo => {
        return null;
    }

    nodeDeleted = (_ust: AppState, _nodeId: string): void => {
    }

    replaceNode = (_ust: AppState, _newNode: J.NodeInfo): void => {
    }

    processNode = (_ust: AppState, _func: (node: J.NodeInfo) => void): void => {
    }
}
