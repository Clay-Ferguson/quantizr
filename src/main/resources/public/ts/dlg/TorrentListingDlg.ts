import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import { DialogMode } from "../enums/DialogMode";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Div } from "../widget/Div";
import { Spinner } from "../widget/Spinner";
import { AudioPlayerDlg } from "./AudioPlayerDlg";
import { VideoPlayerDlg } from "./VideoPlayerDlg";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* NOTE: The other option for how to import webtorrent is to just
 pull in the JS like below (in which case we can also remove NodePolyfillPlugin too
 from the webpack config script) */
// import WebTorrent from "webtorrent/webtorrent.min.js";

export class TorrentListingDlg extends DialogBase {
    torrentSeeded = false;

    constructor(private torrentId: string, dialogMode: DialogMode, state: AppState) {
        super("Torrent", null, false, state, dialogMode);
        this.mergeState({ done: false, files: [] });
        this.whenElm(() => {
            this.load();
        });

        // wait a few seconds before displaying message this torrent may be dead.
        setTimeout(() => {
            if (!this.torrentSeeded) {
                this.mergeState({ noSeeders: true });
            }
        }, 6000);
    }

    renderDlg(): CompIntf[] {
        let children: CompIntf[] = [];

        if (!this.getState().files || this.getState().files.length === 0) {
            children.push(new Div("Loading Torrent..."));
            children.push(new Spinner());
            if (this.getState().noSeeders) {
                children.push(new Div("No seeders found yet. This torrent may be dead?"));
            }
        }

        this.getState().files.forEach((f: any) => {
            children.push(new Div(f.tf.name, {
                className: "torrentListItem",
                onClick: () => {
                    this.openTorrentFile(f);
                }
            }));
        });

        if (this.getState().done) {
            children.push(new Div("Torrent complete."));
        }

        children.push(new ButtonBar([
            new Button("Close", this.close)
        ], "marginTop"));
        return children;
    }

    openTorrentFile = (f: any) => {
        this.close();
        // todo-0: need better way to detect video v.s. audio, and a more complete list.
        if (f.tf.name.toLowerCase().endsWith(".mp4")) {
            new VideoPlayerDlg("torrentVidPlayer" + this.getId(), f.url, f.tf.name, DialogMode.FULLSCREEN, this.appState).open();
        }
        else if (f.tf.name.toLowerCase().endsWith(".mp3")) {
            new AudioPlayerDlg(f.tf.name, null, null, f.url, 0, this.appState).open();
        }
        else {
            window.open(f.url, "_blank");
        }
    }

    onTorrentFile = (f) => {
        // console.log("Found File: " + f.name + " file.length=" + f.length);
        this.torrentSeeded = true;

        f.getBlobURL((err: any, url: string) => {
            if (err) return console.error(err.message);

            // Some type of bizarre state bug exists where if we do a merge state even asynchronously
            // but just too soon, things fail.
            setTimeout(() => {
                let files = this.getState().files;
                this.mergeState({ files: [...files, { tf: f, url }] });
            }, 250);
        })
    }

    onTorrent = (torrent) => {
        // console.log("Torrent added: " + this.torrentId);

        torrent.on("done", () => {
            this.mergeState({ done: true });
        });

        // Torrents can contain many files. For now instead of letting user pick from files just
        // choose whatever the largest file is.
        torrent.files.forEach(f => this.onTorrentFile(f));
    }

    load = () => {
        if (!this.torrentId) return;
        console.log("Loading torrent: " + this.torrentId);

        // Example, should always be available. It's the WebTorrent sample movie.
        // this.torrentId = "magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel&tr=udp%3A%2F%2Fexplodie.org%3A6969&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Ftracker.empire-js.us%3A1337&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.fastcast.nz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com&ws=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2F&xs=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2Fsintel.torrent"

        let torrent = S.torrent.wtc.get(this.torrentId);
        if (torrent) {
            this.onTorrent(torrent);
        }
        else {
            S.torrent.wtc.add(this.torrentId, this.onTorrent);
        }
    }

    /* When the dialog closes we need to stop and remove the player */
    close(): void {
        super.close();
    }
}
