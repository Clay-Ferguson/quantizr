import { AudioPlayerDlg } from "../dlg/AudioPlayerDlg";
import { AppState } from "../AppState";

export interface PodcastIntf {
    player: HTMLAudioElement;
    startTimePending: number;
    openPlayerDialog(mp3Url: string, rssTitle: string, state: AppState);
    restoreStartTime(): void;
    onCanPlay(dlg: AudioPlayerDlg): void;
    onTimeUpdate(dlg: AudioPlayerDlg): void;
    saveTime(state: AppState): void;
    pause(state: AppState): void;
    destroyPlayer(dlg: AudioPlayerDlg, state: AppState): void;
    play(): void;
    speed(rate: number): void;
    skip(delta: number): void;
}
