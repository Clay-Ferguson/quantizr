import { CompIntf } from "../comp/base/CompIntf";
import { Div } from "../comp/core/Div";
import { VideoPlayer } from "../comp/core/VideoPlayer";
import { DialogBase } from "../DialogBase";
import { DialogMode } from "../enums/DialogMode";

/**
 * See also: AudioPlayerDlg (which is very similar)
 */
export class VideoPlayerDlg extends DialogBase {
    videoPlayer: VideoPlayer;

    constructor(private domId: string, private sourceUrl: string, private mediaTitle: string, dialogMode: DialogMode) {
        super(mediaTitle || "Video", null, false, dialogMode);
    }

    renderDlg(): CompIntf[] {
        return [
            // space is at a premium for mobile, so let's just not even show the header.
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

    super_close = this.close;
    /* When the dialog closes we need to stop and remove the player */
    close = () => {
        // console.log("VideoPlayerDialog cancel()");
        // todo-2: need to check over, and document flow of this function as it relates to calling "podcast.destroyPlayer(this);"
        this.destroyPlayer();
        this.super_close();
    }

    destroyPlayer = () => {
        let player = this.videoPlayer ? this.videoPlayer.getVideoElement() : null;
        if (player) {
            player.pause();
            player.remove();
            this.videoPlayer = null;
            this.close();
        }
    }
}
