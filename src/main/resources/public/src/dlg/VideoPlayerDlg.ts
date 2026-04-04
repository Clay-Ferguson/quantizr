import { Comp } from "../comp/base/Comp";
import { Div } from "../comp/core/Div";
import { VideoPlayer } from "../comp/core/VideoPlayer";
import { DialogBase, DialogMode } from "../DialogBase";

/**
 * See also: AudioPlayerDlg (which is very similar)
 */
export class VideoPlayerDlg extends DialogBase {
    videoPlayer: VideoPlayer;

    constructor(private domId: string, private sourceUrl: string, mediaTitle: string, dialogMode: DialogMode) {
        super(mediaTitle || "Video", null, null, dialogMode);
    }

    renderDlg(): Comp[] {
        return [
            new Div(null, { className: "videoContainer" }, [
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
        ];
    }

    getVideoElement(): HTMLVideoElement {
        return this.videoPlayer.getVideoElement();
    }

    /* When the dialog closes we need to stop and remove the player */
    override close() {
        // todo-2: need to check over, and document flow of this function as it relates to calling "podcast.destroyPlayer(this);"
        this.destroyPlayer();
        super.close();
    }

    destroyPlayer() {
        const player = this.videoPlayer ? this.videoPlayer.getVideoElement() : null;
        if (player) {
            player.pause();
            player.remove();
            this.videoPlayer = null;
            this.close();
        }
    }
}
