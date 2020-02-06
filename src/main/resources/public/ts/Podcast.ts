import { AudioPlayerDlg } from "./dlg/AudioPlayerDlg";
import * as I from "./Interfaces";
import * as J from "./JavaIntf";
import { PodcastIntf } from "./intf/PodcastIntf";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants } from "./Constants";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

/*
NOTE: The AudioPlayerDlg AND this singleton-ish class both share some state and cooperate

Reference: https://www.w3.org/2010/05/video/mediaevents.html
*/
export class Podcast implements PodcastIntf {
    player: HTMLAudioElement = null;
    startTimePending: number = null;

    /** 
    NOTE: Originally this app had an automatic AD-blocking 
    feature (see adSegments, commented out currently in the code), which automatically made this player
    skip right over ADs just like they didn't even exist!
    
    I also decided I love the Podcast industry and creating a technology to hurt their revenue streams didn't seem
    beneficial to the industry as a whole.

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

    openPlayerDialog = (mp3Url: string, rssTitle: string) => {
        let urlHash = S.util.hashOfString(mp3Url);
        this.startTimePending = localStorage[urlHash];

        //console.log("startTimePending = localStorage["+urlHash+"]="+localStorage[urlHash]);

        new AudioPlayerDlg(mp3Url, rssTitle).open();
    }

    /* convert from fomrat "minutes:seconds" to absolute number of seconds
    *
    * todo-2: make this accept just seconds, or min:sec, or hour:min:sec, and be able to
    * parse any of them correctly.
    */
    private convertToSeconds = (timeVal: string) => {
        /* end time is designated with asterisk by user, and represented by -1 in variables */
        if (timeVal == '*') return -1;
        let timeParts: string[] = timeVal.split(":");
        if (timeParts.length != 2) {
            console.log("invalid time value: " + timeVal);
            return;
        }
        let minutes = new Number(timeParts[0]).valueOf();
        let seconds = new Number(timeParts[1]).valueOf();
        return minutes * 60 + seconds;
    }

    restoreStartTime = () => {
        /* makes player always start wherever the user last was when they clicked "pause" */
        if (this.player && this.startTimePending) {
            //console.log("setting time on player: "+this.startTimePending);
            this.player.currentTime = this.startTimePending;
            this.startTimePending = null;
        }
    }

    onCanPlay = (dlg: AudioPlayerDlg): void => {
        this.player = dlg.getAudioElement();
        this.restoreStartTime();
        this.player.play();
    }

    onTimeUpdate = (dlg: AudioPlayerDlg): void => {
        //console.log("CurrentTime=" + elm.currentTime);
        this.player = dlg.getAudioElement();

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

    saveTime = (): void => {
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
                console.log("closing player, because it was detected as not visible. player dialog get hidden?");
                this.player.pause();
            }

            this.savePlayerInfo(this.player.src, this.player.currentTime);
        }
    }

    pause = (): void => {
        if (this.player) {
            this.player.pause();
            this.savePlayerInfo(this.player.src, this.player.currentTime);
        }
    }

    destroyPlayer = (dlg: AudioPlayerDlg): void => {
        if (this.player) {
            console.log("player.pause()");
            this.player.pause();

            setTimeout(() => {
                console.log("savePlayerInfo");
                this.savePlayerInfo(this.player.src, this.player.currentTime);

                //let localPlayer = this.player;
                this.player = null;
                //localPlayer.remove();

                if (dlg) {
                    dlg.cancel();
                }
            }, 250);
        }
    }

    play = (): void => {
        if (this.player) {
            this.player.play();
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

    savePlayerInfo = (url: string, timeOffset: number): void => {
        if (S.meta64.isAnonUser) return;
        let urlHash = S.util.hashOfString(url);
        localStorage[urlHash] = timeOffset;
        //console.log("localStorage["+urlHash+"]="+timeOffset);
    }
}
