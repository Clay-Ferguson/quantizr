import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as I from "../Interfaces";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { AudioPlayer } from "../widget/AudioPlayer";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Form } from "../widget/Form";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

/**
 * See also: AudioPlayerDlg (which is very similar)
 * 
 * This is an audio player dialog that has ad-skipping technology provided by podcast.ts
 *
 * NOTE: currently the AD-skip (Advertisement Skip) feature is a proof-of-concept (and it does functionally work!), but croud sourcing
 * the collection of the time-offsets of the begin/end array of commercial segments has not yet been implemented. Also I decided
 * creating technology to destroy podcast's ability to collect ad-revenue is counter-productive to the entire podcasting industry
 * which is an industry i love, and I won't want to be associated with such a hostile act against podcasters as trying to eliminate
 * their ads!! So the ad-skipping is on hold, but this AudioPlayer still of course functions fine just to play podcasts normally.
 * 
 * WARNING: DO NOT TRY to add react 'state' to this dialog. Let it render once and never call mergeState or any kind of state update
 *          because it looks like when react re-renders a media component it can't do so without breaking it, which makes sense because
 *          a media player (audio or video) isn't something that can just be replaced in the DOM while it's already playing.
 * 
 * https://www.w3.org/2010/05/video/mediaevents.html
 */
export class AudioPlayerDlg extends DialogBase {

    player: HTMLAudioElement;
    audioPlayer: AudioPlayer;
    playButton: Button;

    startTimePending: number = null;

    /** 
    NOTE: Originally this app had an automatic AD-blocking 
    feature (see adSegments, commented out currently in the code), which automatically made this player
    skip right over ADs just like they didn't even exist!
    
    If the 'adSegments' array variable below contains an array of start/stop times then during playback this player will seamlessly and autmatically
    jump over those time ranges in the audio just like they didn't even exist. It's basically censoring out those time ranges.
    Currently we aren't using this at all, but was the core of the ad-blocker featue that i deciced to remove.
    
    Interestingly, and entire website/service would be build around doing sort the 'inverse' of this feature where we could have
    a feature where ONLY a custom series of playback time ranges are include, and use this to build up some discussion or some way to 
    built a community around people who can post 'custom segments' they somehow choose, and then open up just that one or more segmens
    of audio to have online discussion threads about certain specific parts of any podcast or media.
    */
    private adSegments: I.AdSegment[] = null;
    private saveTimer: any = null;
    urlHash: string;

    constructor(private sourceUrl: string, state: AppState) {
        super("Audio Player", null, false, state);

        this.urlHash = S.util.hashOfString(sourceUrl);
        this.startTimePending = localStorage[this.urlHash];
        //console.log("startTimePending = localStorage[" + this.urlHash + "]=" + localStorage[this.urlHash]);
    }

    renderDlg(): CompIntf[] {
        let children = [
            new Form(null, [
                //new TextContent(this.title), 
                this.audioPlayer = new AudioPlayer({
                    src: this.sourceUrl,
                    style: {
                        width: "100%",
                        padding: "0px",
                        marginTop: "0px",
                        marginLeft: "0px",
                        marginRight: "0px",
                        marginBottom: "16px"
                    },
                    onPause: () => { this.savePlayerInfo(this.player.src, this.player.currentTime); },
                    onTimeUpdate: () => { this.onTimeUpdate(); },
                    onCanPlay: () => { this.restoreStartTime(); },
                    controls: "controls",
                    autoPlay: "autoplay",
                    preload: "auto"
                }),
                new ButtonBar([
                    this.playButton = new Button("Pause", this.playButtonFunction, null, "btn-primary"),
                    new Button("Close", this.destroyPlayer)
                ]),
                new ButtonBar([
                    new Button("< 30s", this.skipBack30Button),
                    new Button("30s >", this.skipForward30Button)
                ]),
                new ButtonBar([
                    new Button("1x", this.normalSpeedButton),
                    new Button("1.5x", this.speed15Button),
                    new Button("2x", this.speed2Button)
                ])
            ])
        ];

        this.audioPlayer.whenElm((elm: HTMLAudioElement) => {
            this.player = elm;
            //use a very long delay here, to be sure media player has had time to do what it needs to do.
            setTimeout(this.updatePlayButtonText, 3000);
        });

        return children;
    }

    renderButtons(): CompIntf {
        return null;
    }

    cancel(): void {
        this.close();
        if (this.player) {
            //console.log("player pause and remove");
            this.player.pause();
            this.player.remove();
        }
    }

    updatePlayButtonText = (): void => {
        if (this.player) {
            this.playButton.setText(this.player.paused || this.player.ended ? "Play" : "Pause");
        }
    }

    playButtonFunction = (): void => {
        if (this.player) {
            if (this.player.paused || this.player.ended) {
                this.player.play();
                if (this.playButton) {
                    this.playButton.setText("Pause");
                }
            }
            else {
                this.player.pause();
                if (this.playButton) {
                    this.playButton.setText("Play");
                }
            }
        }
    }

    speed = (rate: number): void => {
        if (this.player) {
            this.player.playbackRate = rate;
        }
    }

    skip = (delta: number): void => {
        if (this.player) {
            this.player.currentTime += delta;
        }
    }

    speed2Button = (): void => {
        this.speed(2);
    }

    speed15Button = (): void => {
        this.speed(1.5);
    }

    normalSpeedButton = (): void => {
        this.speed(1.0);
    }

    skipBack30Button = (): void => {
        this.skip(-30);
    }

    skipForward30Button = (): void => {
        this.skip(30);
    }

    destroyPlayer = (): void => {
        if (this.player) {
            this.player.pause();
        }
        this.cancel();
    }

    restoreStartTime = () => {
        /* makes player always start wherever the user last was when they clicked "pause" */
        if (this.player && this.startTimePending) {
            //console.log("setting time on player: "+this.startTimePending);
            this.player.currentTime = this.startTimePending;
            this.startTimePending = null;
        }
    }

    onTimeUpdate = (): void => {
        //console.log("CurrentTime=" + this.player.currentTime);

        if (!this.saveTimer) {
            /* save time offset into browser local storage every 3 seconds */
            this.saveTimer = setInterval(this.saveTime, 3000);
        }

        /* todo-1: we call restoreStartTime upon loading of the component but it doesn't seem to have the effect doing anything at all
        and can't even update the slider displayed position, until playins is STARTED. Need to come back and fix this because users
        currently have the glitch of always hearing the first fraction of a second of video, which of course another way to fix
        would be by altering the volumn to zero until restoreStartTime has gone into effect */
        this.restoreStartTime();

        if (this.adSegments) {
            for (let seg of this.adSegments) {
                /* endTime of -1 means the rest of the media should be considered ADs */
                if (this.player.currentTime >= seg.beginTime && //
                    (this.player.currentTime <= seg.endTime || seg.endTime < 0)) {

                    /* jump to end of audio if rest is an add, with logic of -3 to ensure we don't
                    go into a loop jumping to end over and over again */
                    if (seg.endTime < 0 && this.player.currentTime < this.player.duration - 3) {
                        /* jump to last to seconds of audio, i'll do this instead of pausing, in case
                         there are is more audio automatically about to play, we don't want to halt it all */
                        this.player.loop = false;
                        this.player.currentTime = this.player.duration - 2;
                    }
                    /* or else we are in a comercial segment so jump to one second past it */
                    else {
                        this.player.currentTime = seg.endTime + 1;
                    }
                    return;
                }
            }
        }
    }

    saveTime = (state: AppState): void => {
        /* the purpose of this timer is to be sure the browser session doesn't timeout while user is playing
        but if the media is paused we DO allow it to timeout. Othwerwise if user is listening to audio, we
        contact the server during this timer to update the time on the server AND keep session from timing out

        UPDATE: once i changed the savePlayerInfo to be client-only (no server call) we will have to come up with some
        other way to ping the server periorically to ensure no timeout of browser during playback IF we desire that even?
        */
        if (this.player && !this.player.paused) {
            /* this safety check to be sure no hidden audio can still be playing should no longer be needed
            now that I have the close listener even on the dialog, but i'll leave this here anyway. Can't hurt. */
            if (!S.util.isElmVisible(this.player)) {
                //console.log("closing player, because it was detected as not visible. player dialog get hidden?");
                this.player.pause();
            }

            this.savePlayerInfo(this.player.src, this.player.currentTime);
        }
    }

    savePlayerInfo = (url: string, timeOffset: number): void => {
        if (this.appState.isAnonUser) return;
        let urlHash = S.util.hashOfString(url);
        localStorage[urlHash] = timeOffset;
        //console.log("localStorage[" + urlHash + "]=" + timeOffset);
    }
}
