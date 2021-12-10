import WebTorrent from "webtorrent";
import { dispatch } from "./AppRedux";
import { AppState } from "./AppState";
import { Constants as C } from "./Constants";
import { PubSub } from "./PubSub";
import { Singletons } from "./Singletons";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class Torrent {
    wtc: WebTorrent.Instance = new WebTorrent();

    constructor() {
        this.wtc.on("error", (err: any) => {
            console.error("TORRENT ERROR: " + err.message);
        });

        this.wtc.on("torrent", (torrent: any) => {
            console.log("Torrent Ready:" + torrent.magnetURI);
        });
    }

    dumpTorrents = () => {
        let msg = "";
        if (!this.wtc.torrents || this.wtc.torrents.length === 0) {
            msg = "No torrents exist."
        }
        else {
            this.wtc.torrents.forEach(torrent => {
                msg += "torrent: " + torrent.magnetURI + "\n";
                torrent.files.forEach(file => {
                    msg += "    file: " + file.name + " [" + file.length + "]\n";
                });
                msg += "\n";
            });
        }

        dispatch("Action_showServerInfo", (s: AppState): AppState => {
            S.quanta.tabChanging(s.activeTab, C.TAB_SERVERINFO, s);
            s.activeTab = S.quanta.activeTab = C.TAB_SERVERINFO;
            s.serverInfoText = msg;
            s.serverInfoCommand = null;
            s.serverInfoTitle = "WebTorrents";
            return s;
        });
    }
}
