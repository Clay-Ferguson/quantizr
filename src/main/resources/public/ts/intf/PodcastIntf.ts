console.log("PodcastIntf.ts");


import { AudioPlayerDlg } from "../dlg/AudioPlayerDlg";

export interface PodcastIntf {
    player: HTMLAudioElement;
    startTimePending: number;
    openPlayerDialog(mp3Url: string, rssTitle: string);
    restoreStartTime(): void;
    onCanPlay(dlg: AudioPlayerDlg): void;
    onTimeUpdate(dlg: AudioPlayerDlg): void;
    saveTime(): void;
    pause(): void;
    destroyPlayer(dlg: AudioPlayerDlg): void;
    play(): void;
    speed(rate: number): void;
    skip(delta: number): void;
}
