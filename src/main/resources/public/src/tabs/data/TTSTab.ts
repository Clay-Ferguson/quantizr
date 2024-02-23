import { getAs } from "../../AppContext";
import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { OpenGraphPanel } from "../../comp/OpenGraphPanel";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import { NodeInfo } from "../../JavaIntf";
import { TTSView } from "../TTSView";

export class TTSTab implements TabIntf<any> {
    name = "Text-to-Speech";
    tooltip = "Listen to text";
    id = C.TAB_TTS;
    scrollPos = 0;
    props = {};
    openGraphComps: OpenGraphPanel[] = [];
    topmostVisibleElmId: string = null;

    static inst: TTSTab = null;
    static ttsTabSelected: boolean = false;

    constructor() {
        TTSTab.inst = this;
    }

    isVisible = () => {
        return getAs().ttsRan || TTSTab.ttsTabSelected;
    };

    constructView = (data: TabIntf) => new TTSView(data);
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
