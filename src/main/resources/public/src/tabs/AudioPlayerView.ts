import { AppTab } from "../comp/AppTab";
import { Comp } from "../comp/base/Comp";
import { AudioPlayer } from "../comp/core/AudioPlayer";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { Heading } from "../comp/core/Heading";
import { Icon } from "../comp/core/Icon";
import { TabHeading } from "../comp/core/TabHeading";
import { TextField } from "../comp/core/TextField";
import * as I from "../Interfaces";
import { TabBase } from "../intf/TabBase";
import { S } from "../Singletons";
import { Validator } from "../Validator";

/**
 * NOTE: currently the AD-skip (Advertisement Skip) feature is a proof-of-concept (and it does
 * functionally work!), but croud sourcing the collection of the time-offsets of the begin/end array
 * of commercial segments has not yet been implemented. Also I decided creating technology to
 * destroy podcast's ability to collect ad-revenue is counter-productive to the entire podcasting
 * industry which is an industry i love, and I won't want to be associated with such a hostile act
 * against podcasters as trying to eliminate their ads!! So the ad-skipping technology in here is
 * disabled.
 *
 * https://www.w3.org/2010/05/video/mediaevents.html 
 * See also: VideoPlayerDlg (which is very similar)
 */
export class AudioPlayerView extends AppTab<any, AudioPlayerView> {

    public static customTitle: string;
    public static customSubTitle: string;
    public customDiv: Comp;
    public static sourceUrl: string;
    public static startTimePendingOverride: number;
    public playingMemoryBlob: boolean

    player: HTMLAudioElement;
    audioPlayer: AudioPlayer;
    startTimePending: number = null;

    /*
    If the 'adSegments' array variable below contains an array of start/stop times then during
    playback this player will seamlessly and autmatically jump over those time ranges in the audio
    during playing just like they didn't even exist, basically censoring out those time ranges.
    Currently we aren't using this at all, because it's not friendly to the podcasting industry!
    */
    private adSegments: I.AdSegment[] = null;
    private saveTimer: any = null;

    timeLeftTextField: TextField;
    timeLeftState: Validator = new Validator();

    intervalTimer: any;
    playButton: Icon;
    pauseButton: Icon;

    constructor(data: TabBase<any, AudioPlayerView>) {
        super(data);
        data.inst = this;
    }

    override preRender(): boolean | null {
        this.init();

        this.children = [
            this.headingBar = new TabHeading([
                new Div("Audio Player", { className: "tabTitle" })
            ], null),
            new Div(null, { className: "bigMarginTop bigMarginRight" }, [
                AudioPlayerView.customTitle ? new Heading(2, AudioPlayerView.customTitle) : null,
                AudioPlayerView.customSubTitle ? new Heading(4, AudioPlayerView.customSubTitle) : null,
                this.audioPlayer = new AudioPlayer({
                    src: AudioPlayerView.sourceUrl,
                    className: "audioPlayer",
                    onPause: () => this.savePlayerInfo(this.player.src, this.player.currentTime),
                    onTimeUpdate: this.onTimeUpdate,
                    onCanPlay: this.restoreStartTime,
                    onEnded: this.onEnded,
                    controls: "controls",
                    autoPlay: "autoplay",
                    preload: "auto",
                    controlsList: "nodownload"
                }),
                new Div(null, { className: "row" }, [
                    // todo-0: make speed choices be a radio button group
                    new ButtonBar([
                        new Button("1x", () => this.speed(1)),
                        new Button("1.25x", () => this.speed(1.25)),
                        new Button("1.5x", () => this.speed(1.5)),
                        new Button("1.75x", () => this.speed(1.75)),
                        new Button("2x", () => this.speed(2))
                    ], "col-9"),
                    new ButtonBar([
                        new Button("< 30s", () => this.skip(-30)),
                        new Button("30s >", () => this.skip(30))
                    ], "col-3 float-end")
                ]),
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
                !this.playingMemoryBlob ? new Div(null, null, [
                    // (todo-0: fix this), but for now I'm using a div to limit width
                    new Div(null, { className: "timeRemainingEditField" }, [
                        this.timeLeftTextField = new TextField({
                            label: "Timer (mins.)",
                            labelLeft: true,
                            val: this.timeLeftState
                        })
                    ])
                ]) : null,
                this.customDiv
            ])
        ];

        this.audioPlayer.onMount((elm: HTMLElement) => {
            this.player = elm as HTMLAudioElement;
            if (!this.player) return;
            this.player.onpause = (_event) => this.updatePlayButton();
            this.player.onplay = (_event) => this.updatePlayButton();
            this.player.onended = (_event) => this.updatePlayButton();
        });
        return true;
    }

    init() {
        const urlHash = S.util.hashOfString(AudioPlayerView.sourceUrl);
        this.startTimePending = localStorage[urlHash];

        if (this.intervalTimer) {
            this.intervalTimer = setInterval(() => {
                this.oneMinuteTimeslice();
            }, 60000);

            setTimeout(() => {
                this.updatePlayButton();
            }, 750);
        }
    }

    override domRemoveEvent(): any {
        super.domRemoveEvent();
        S.quanta.audioPlaying = false;
        if (this.intervalTimer) {
            clearInterval(this.intervalTimer);
        }
        if (this.saveTimer) {
            clearInterval(this.saveTimer);
        }
    }

    // This makes the sleep timer work "Stop After (mins.)"
    oneMinuteTimeslice = () => {
        if (!S.quanta.audioPlaying) return;
        if (this.timeLeftState.getValue()) {
            try {
                let timeVal = parseInt(this.timeLeftState.getValue());
                timeVal--;
                this.timeLeftState.setValue(timeVal <= 0 ? "" : "" + timeVal);
                if (timeVal <= 0 && this.player && !this.player.paused && !this.player.ended) {
                    this.player.pause();
                }
            }
            catch (e) {
                // ignore
            }
        }
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
        if (this.player) {
            this.player.pause();
            this.player.remove();
        }
    }

    speed = (rate: number) => {
        if (this.player) {
            this.player.playbackRate = rate;
        }
    }

    skip = (delta: number) => {
        if (this.player) {
            this.player.currentTime += delta;
        }
    }

    // keeping for now. This was what the dialog "close" button ran
    // destroyPlayer = () => {
    //     S.quanta.audioPlaying = false;
    //     if (this.player) {
    //         this.player.pause();
    //     }
    //     this.cancel();
    // }

    restoreStartTime = () => {
        /* makes player always start wherever the user last was when they clicked "pause" */
        if (this.player) {
            if (AudioPlayerView.startTimePendingOverride > 0) {
                this.player.currentTime = AudioPlayerView.startTimePendingOverride;
                AudioPlayerView.startTimePendingOverride = null;
                this.startTimePending = null;
            }
            else if (this.startTimePending) {
                this.player.currentTime = this.startTimePending;
                this.startTimePending = null;
            }
        }
    }

    onEnded = () => {
        if (this.player) {
            this.player.currentTime = 0;
            this.savePlayerInfo(this.player.src, 0);
            this.player.pause();
        }
    }

    onTimeUpdate = () => {
        if (!this.saveTimer) {
            /* save time offset into browser local storage every 3 seconds */
            this.saveTimer = setInterval(this.saveTime, 3000);
        }

        this.restoreStartTime();

        if (this.adSegments) {
            for (const seg of this.adSegments) {
                /* endTime of -1 means the rest of the media should be considered ADs */
                if (this.player.currentTime >= seg.beginTime && //
                    (this.player.currentTime <= seg.endTime || seg.endTime < 0)) {

                    /* jump to end of audio if rest is an add, with logic of -3 to ensure we don't
                    go into a loop jumping to end over and over again */
                    if (seg.endTime < 0 && this.player.currentTime < this.player.duration - 3) {
                        /* jump to last to seconds of audio, i'll do this instead of pausing, in
                         case there are is more audio automatically about to play, we don't want to
                         halt it all */
                        this.player.loop = false;
                        this.player.currentTime = this.player.duration - 2;
                    }
                    /* or else we are in a commercial segment so jump to one second past it */
                    else {
                        this.player.currentTime = seg.endTime + 1;
                    }
                    return;
                }
            }
        }
    }

    saveTime = () => {
        if (this.player && !this.player.paused) {
            /* this safety check to be sure no hidden audio can still be playing should no longer be
            needed now that I have the close listener even on the dialog, but i'll leave this here
            anyway. Can't hurt. */
            if (!S.util.isElmVisible(this.player)) {
                this.player.pause();
            }

            this.savePlayerInfo(this.player.src, this.player.currentTime);
        }
    }

    savePlayerInfo = (url: string, timeOffset: number) => {
        const urlHash = S.util.hashOfString(url);
        localStorage[urlHash] = timeOffset;
    }
}
