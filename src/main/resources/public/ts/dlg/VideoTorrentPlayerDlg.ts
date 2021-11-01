import { AppState } from "../AppState";
import { DialogBase } from "../DialogBase";
import { DialogMode } from "../enums/DialogMode";
import { CompIntf } from "../widget/base/CompIntf";
import { Div } from "../widget/Div";

// webtorrent not yet working from NPM. Creates lots of dependency errors.
// import WebTorrent from "webtorrent";

// loading thru CDN this works.
declare var WebTorrent;

export class VideoTorrentPlayerDlg extends DialogBase {
    videoDiv: Div = null;

    constructor(private domId: string, private sourceUrl: string, private mediaTitle: string, dialogMode: DialogMode, state: AppState) {
        super(mediaTitle || "Video", null, false, state, dialogMode);

        setTimeout(() => {
            this.load();
        }, 1000);
    }

    renderDlg(): CompIntf[] {
        return [
            this.videoDiv = new Div("")
        ];
    }

    load = () => {
        let client: any = new WebTorrent();

        // Sintel, a free, Creative Commons movie
        let torrentId = "magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel&tr=udp%3A%2F%2Fexplodie.org%3A6969&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Ftracker.empire-js.us%3A1337&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.fastcast.nz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com&ws=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2F&xs=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2Fsintel.torrent"

        client.add(torrentId, (torrent) => {
            // Torrents can contain many files. Let's use the .mp4 file
            var file = torrent.files.find((file) => {
                console.log("Found File: " + file.name);
                return file.name.endsWith(".mp4")
            })

            // Display the file by adding it to the DOM.
            // Supports video, audio, image files, and more!
            file.appendTo("#" + this.videoDiv.getId());
        })
    }

    // getVideoElement(): HTMLVideoElement {
    //     return this.videoPlayer.getVideoElement();
    // }

    /* When the dialog closes we need to stop and remove the player */
    close(): void {
        // console.log("VideoPlayerDialog cancel()");
        // todo-2: need to check over, and document flow of this function as it relates to calling "podcast.destroyPlayer(this);"
        // this.destroyPlayer();
        super.close();
    }

    // destroyPlayer = (): void => {
    //     let player = this.videoPlayer ? this.videoPlayer.getVideoElement() : null;
    //     if (player) {
    //         player.pause();
    //         player.remove();
    //         this.videoPlayer = null;
    //         this.close();
    //     }
    // }
}
