import { getAs } from "../../AppContext";
import { Constants as C } from "../../Constants";
import { TabBase } from "../../intf/TabBase";
import { TTSView } from "../TTSView";

export class TTSTab extends TabBase<any, TTSView> {
    name = "Text-to-Speech";
    tooltip = "Listen to text";
    id = C.TAB_TTS;
    static inst: TTSTab = null;
    static ttsTabSelected: boolean = false;

    constructor() {
        super();
        TTSTab.inst = this;
    }

    isVisible() {
        return getAs().ttsRan || TTSTab.ttsTabSelected;
    }

    constructView(data: TabBase<any, TTSView>): TTSView {
        return new TTSView(data);
    }
}
