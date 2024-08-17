import { getAs } from "../../AppContext";
import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { OpenGraphPanel } from "../../comp/OpenGraphPanel";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import { NodeInfo } from "../../JavaIntf";
import { AdminView } from "../AdminView";

export class AdminTab implements TabIntf<any> {
    name = "Admin";
    tooltip = "Manage the Server Instance";
    id = C.TAB_ADMIN;
    scrollPos = 0;
    props = {};
    openGraphComps: OpenGraphPanel[] = [];
    topmostVisibleElmId: string = null;

    static inst: AdminTab = null;
    static tabSelected: boolean = false;

    constructor() {
        AdminTab.inst = this;
    }

    isVisible = () => {
        return getAs().isAdminUser;
    };

    constructView = (data: TabIntf) => new AdminView(data);
    getTabSubOptions = (): Div => { return null; };

    findNode = (_nodeId: string): NodeInfo => {
        return null;
    }

    findNodeByPath = (_path: string): NodeInfo => {
        return null;
    }

    nodeDeleted = (_ust: AppState, _nodeId: string): void => {
    }

    replaceNode = (_ust: AppState, _newNode: NodeInfo): void => {
    }

    processNode = (_ust: AppState, _func: (node: NodeInfo) => void): void => {
    }
}
