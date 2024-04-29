import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { OpenGraphPanel } from "../../comp/OpenGraphPanel";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import { NodeInfo } from "../../JavaIntf";
import { AISettingsView } from "../AISettingsView";

export class AISettingsTab implements TabIntf<any> {
    name = "AI Settings";
    tooltip = "Edit your AI Settings";
    id = C.TAB_AI_SETTINGS;
    scrollPos = 0;
    props = {};
    openGraphComps: OpenGraphPanel[] = [];
    topmostVisibleElmId: string = null;

    static inst: AISettingsTab = null;
    static tabSelected: boolean = false;

    constructor() {
        AISettingsTab.inst = this;
    }

    isVisible = () => {
        return AISettingsTab.tabSelected;
    };

    constructView = (data: TabIntf) => new AISettingsView(data);
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
