import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import { DialogMode } from "../enums/DialogMode";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Anchor } from "../widget/Anchor";
import { CompIntf } from "../widget/base/CompIntf";
import { Div } from "../widget/Div";

/* IMPORTANT:
This class is no longer being used because all the appendTo function of WebTorrent actually
does is add a video element and point it to the 'url' of the torrent, so we can do better than that
with our already-existing Video and Audio players, so this class may end up being used at some point
but only for unregognized kinds of files perhaps, as a fallback to let WebPack do whatever it wants
with unknown file types.
*/

/* NOTE: The other option for how to import webtorrent is to just
 pull in the JS like below (in which case we can also remove NodePolyfillPlugin too
 from the webpack config script) */
// import WebTorrent from "webtorrent/webtorrent.min.js";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

interface LS {
    downloadLink: string;
}

export class VideoTorrentPlayerDlg extends DialogBase {
    videoDiv: Div = new Div(null, {
        className: "webTorrentPlayer"
    });

    constructor(private torrentId: string, dialogMode: DialogMode, state: AppState) {
        super("Torrents", null, false, state, dialogMode);
        this.mergeState<LS>({ downloadLink: null });
        this.videoDiv.whenElm((elm: HTMLElement) => {
            this.load();
        });
    }

    renderDlg(): CompIntf[] {
        let children: CompIntf[] = [this.videoDiv];
        children.push(new Anchor(this.getState<LS>().downloadLink, "Download", { target: "_blank" }));
        return children;
    }

    load = () => {
        if (!this.torrentId) return;

        // Example, should always be available. It's the WebTorrent sample movie.
        // this.torrentId = "magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel&tr=udp%3A%2F%2Fexplodie.org%3A6969&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Ftracker.empire-js.us%3A1337&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.fastcast.nz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com&ws=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2F&xs=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2Fsintel.torrent"

        S.torrent.wtc.add(this.torrentId, (torrent) => {
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

            file.getBlobURL((err, url) => {
                if (err) return console.error(err.message);

                setTimeout(() => {
                    console.log("url=" + url);
                    this.mergeState<LS>({ downloadLink: url });

                    // Display the file by adding it to the DOM.
                    // Supports video, audio, image files, and more!
                    // NOTE: It's important to only call this append after all other state updates are finalized
                    // becasue this adds to the DOM without React's knowledge, and so any react re-render will blow it away
                    file.appendTo("#" + this.videoDiv.getId());
                }, 250);
            })
        });
    }

    /* When the dialog closes we need to stop and remove the player */
    close(): void {
        super.close();
    }
}
