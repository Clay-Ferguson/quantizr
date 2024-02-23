import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { OpenGraphPanel } from "../../comp/OpenGraphPanel";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import { NodeInfo } from "../../JavaIntf";
import { SettingsView } from "../SettingsView";

export class SettingsTab implements TabIntf<any> {
    name = "Settings";
    tooltip = "Edit your Account Settings";
    id = C.TAB_SETTINGS;
    scrollPos = 0;
    props = {};
    openGraphComps: OpenGraphPanel[] = [];
    topmostVisibleElmId: string = null;

    static inst: SettingsTab = null;
    static tabSelected: boolean = false;

    constructor() {
        SettingsTab.inst = this;
    }

    isVisible = () => {
        return SettingsTab.tabSelected;
    };

    constructView = (data: TabIntf) => new SettingsView(data);
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
