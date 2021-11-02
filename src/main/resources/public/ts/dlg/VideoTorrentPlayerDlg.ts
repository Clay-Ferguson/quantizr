import { AppState } from "../AppState";
import { DialogBase } from "../DialogBase";
import { DialogMode } from "../enums/DialogMode";
import { CompIntf } from "../widget/base/CompIntf";
import { Div } from "../widget/Div";
import WebTorrent from "webtorrent";

/* NOTE: The other option for how to import webtorrent is to just
 pull in the JS like below (and in this case we can remove NodePolyfillPlugin too
 from the webpack config script) */
// import WebTorrent from "webtorrent/webtorrent.min.js";

export class VideoTorrentPlayerDlg extends DialogBase {
    videoDiv: Div = null;
    loaded: boolean = false;

    constructor(private torrentId: string, private mediaTitle: string, dialogMode: DialogMode, state: AppState) {
        super(mediaTitle || "Video", null, false, state, dialogMode);
    }

    renderDlg(): CompIntf[] {
        let children = [this.videoDiv = new Div(null, { className: "webTorrentPlayer" })];
        this.videoDiv.whenElm((elm: HTMLElement) => {
            this.load();
        });
        return children;
    }

    load = () => {
        if (!this.torrentId || this.loaded) return;
        this.loaded = true;
        let client: any = new WebTorrent();

        // Example, should always be available. It's the WebTorrent sample movie.
        // this.torrentId = "magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel&tr=udp%3A%2F%2Fexplodie.org%3A6969&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Ftracker.empire-js.us%3A1337&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.fastcast.nz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com&ws=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2F&xs=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2Fsintel.torrent"

        client.add(this.torrentId, (torrent) => {
            // Torrents can contain many files. For now instead of letting user pick from files just
            // choose whatever the largest file is.
            let file = null;
            let maxFileLen = 0;
            torrent.files.forEach((f) => {
                console.log("Found File: " + f.name + " file.length=" + f.length);
                if (f.length > maxFileLen) {
                    maxFileLen = f.length;
                    file = f;
                }
                // return file.name.endsWith(".mp4");
            });

            // Display the file by adding it to the DOM.
            // Supports video, audio, image files, and more!
            file.appendTo("#" + this.videoDiv.getId());
        });
    }

    /* When the dialog closes we need to stop and remove the player */
    close(): void {
        super.close();
    }
}
