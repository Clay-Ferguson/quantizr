import { Constants as C } from "../../Constants";
import { TabBase } from "../../intf/TabBase";
import { AudioPlayerView } from "../AudioPlayerView";

export class AudioPlayerTab extends TabBase<any, AudioPlayerView> {
    name = "Audio Player";
    tooltip = "Audio Player";
    id = C.TAB_AUDIO_PLAYER;
    static inst: AudioPlayerTab = null;
    static tabShown: boolean = false;
    static sourceUrl: string;

    constructor() {
        super();
        AudioPlayerTab.inst = this;
    }

    isVisible() {
        return AudioPlayerTab.tabShown;
    }

    constructView(data: TabBase<any, AudioPlayerView>): AudioPlayerView {
        return new AudioPlayerView(data);
    }
}
