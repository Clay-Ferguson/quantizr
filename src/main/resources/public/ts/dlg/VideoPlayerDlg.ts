import { AppState } from "../AppState";
import { DialogBase } from "../DialogBase";
import { DialogMode } from "../enums/DialogMode";
import { CompIntf } from "../widget/base/CompIntf";
import { Div } from "../widget/Div";
import { Form } from "../widget/Form";
import { TextContent } from "../widget/TextContent";
import { VideoPlayer } from "../widget/VideoPlayer";

/**
 * See also: AudioPlayerDlg (which is very similar)
 */
export class VideoPlayerDlg extends DialogBase {

    videoPlayer: VideoPlayer;

    constructor(private domId: string, private sourceUrl: string, private mediaTitle: string, dialogMode: DialogMode, state: AppState) {
        super(mediaTitle || "Video", null, false, state, dialogMode);
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                // space is at a premium for mobile, so let's just not even show the header.
                new Div(null, { className: "fullWidth" }, [
                    this.videoPlayer = new VideoPlayer({
                        id: this.domId + "-comp",
                        src: this.sourceUrl,
                        className: "videoPlayerElement",
                        // "ontimeupdate": () => { S.podcast.onTimeUpdate(this); },
                        // "oncanplay": () => { S.podcast.onCanPlay(this); },
                        controls: "controls",
                        autoPlay: "autoplay"
                        // "muted" : "false",
                        // "volume": "0.9",
                        // "preload": "auto"
                    })
                ])
            ])
        ];
    }

    getVideoElement(): HTMLVideoElement {
        return this.videoPlayer.getVideoElement();
    }

    /* When the dialog closes we need to stop and remove the player */
    close(): void {
        // console.log("VideoPlayerDialog cancel()");
        // todo-2: need to check over, and document flow of this function as it relates to calling "podcast.destroyPlayer(this);"
        this.destroyPlayer();
        super.close();
    }

    destroyPlayer = (): void => {
        let player = this.videoPlayer ? this.videoPlayer.getVideoElement() : null;
        if (player) {
            player.pause();
            player.remove();
            this.videoPlayer = null;
            this.close();
        }
    }
}
