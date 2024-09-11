import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { OpenGraphPanel } from "../../comp/OpenGraphPanel";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import { NodeInfo } from "../../JavaIntf";
import { AudioPlayerView } from "../AudioPlayerView";

export class AudioPlayerTab implements TabIntf<any> {
    name = "Audio Player";
    tooltip = "Audio Player";
    id = C.TAB_AUDIO_PLAYER;
    scrollPos = 0;
    props = {};
    openGraphComps: OpenGraphPanel[] = [];
    topmostVisibleElmId: string = null;

    static inst: AudioPlayerTab = null;
    static tabSelected: boolean = false;
    static sourceUrl: string;

    constructor() {
        AudioPlayerTab.inst = this;
    }

    isVisible = () => {
        return AudioPlayerTab.tabSelected;
    };

    constructView = (data: TabIntf) => new AudioPlayerView(data);
    getTabSubOptions = (): Div => { return null; };

    // todo-0: change these fat arrows to normal methods acroass the board
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
