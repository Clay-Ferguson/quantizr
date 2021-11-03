import WebTorrent from "webtorrent";

export interface TorrentIntf {
    wtc: WebTorrent.Instance;
    dumpTorrents(): any;
}
