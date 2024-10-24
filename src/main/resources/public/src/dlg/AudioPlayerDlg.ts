import { Comp } from "../comp/base/Comp";
import { AudioPlayer } from "../comp/core/AudioPlayer";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { Icon } from "../comp/core/Icon";
import { DialogBase } from "../DialogBase";
import { S } from "../Singletons";

export class AudioPlayerDlg extends DialogBase {
    player: HTMLAudioElement;
    audioPlayer: AudioPlayer;
    playButton: Icon;
    pauseButton: Icon;

    constructor(private sourceUrl: string) {
        super("Audio Player");

        setTimeout(() => {
            this.updatePlayButton();
        }, 750);
    }

    override preUnmount(): any {
        S.quanta.audioPlaying = false;
    }

    renderDlg(): Comp[] {
        const children = [
            new Div(null, null, [
                this.audioPlayer = new AudioPlayer({
                    src: this.sourceUrl,
                    className: "audioPlayer",
                    onEnded: this.onEnded,
                    controls: "controls",
                    autoPlay: "autoplay",
                    preload: "auto",
                    controlsList: "nodownload"
                }),

                new Div(null, { className: "playerButtonsContainer" }, [
                    this.playButton = new Icon({
                        className: "playerButton fa fa-play fa-3x",
                        style: { display: "none" },
                        onClick: () => {
                            S.quanta.audioPlaying = true;
                            this.player?.play();
                        }
                    }),
                    this.pauseButton = new Icon({
                        className: "playerButton fa fa-pause fa-3x",
                        onClick: () => {
                            S.quanta.audioPlaying = false;
                            this.player?.pause();
                        }
                    })
                ]),
                new Div(null, { className: "row" }, [
                    new ButtonBar([
                        new Button("Close", this.destroyPlayer, null, "tw-float-right")
                    ], "align-items-end"),
                ])
            ])
        ];

        this.audioPlayer.onMount((elm: HTMLElement) => {
            this.player = elm as HTMLAudioElement;
            if (!this.player) return;

            this.player.onpause = (_event) => {
                this.updatePlayButton();
            };
            this.player.onplay = (_event) => {
                this.updatePlayButton();
            };
            this.player.onended = (_event) => {
                this.updatePlayButton();
            };
        });
        return children;
    }

    updatePlayButton = () => {
        if (!this.player) return;
        this.updatePlayingState();

        this.playButton.onMount((elm: HTMLElement) => {
            this.updatePlayingState();
            elm.style.display = !S.quanta.audioPlaying ? "inline-block" : "none";
        });

        this.pauseButton.onMount((elm: HTMLElement) => {
            this.updatePlayingState();
            elm.style.display = S.quanta.audioPlaying ? "inline-block" : "none";
        });
    }

    updatePlayingState = () => {
        S.quanta.audioPlaying = !this.player.paused && !this.player.ended;
    }

    cancel(): void {
        S.quanta.audioPlaying = false;
        this.close();
        if (this.player) {
            this.player.pause();
            this.player.remove();
        }
    }

    destroyPlayer = () => {
        S.quanta.audioPlaying = false;
        if (this.player) {
            this.player.pause();
        }
        this.cancel();
    }

    onEnded = () => {
        if (this.player) {
            this.player.currentTime = 0;
            this.player.pause();
        }
    }
}
