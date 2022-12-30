import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { OpenGraphPanel } from "../../comp/OpenGraphPanel";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import * as J from "../../JavaIntf";
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

    isVisible = (ast: AppState) => {
        return ast.ttsRan || TTSTab.ttsTabSelected;
    };

    constructView = (data: TabIntf) => new TTSView(data);
    getTabSubOptions = (ast: AppState): Div => { return null; };

    findNode = (ast: AppState, nodeId: string): J.NodeInfo => {
        return null;
    }

    nodeDeleted = (ast: AppState, nodeId: string): void => {
    }

    replaceNode = (ast: AppState, newNode: J.NodeInfo): void => {
    }
}
