import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { AudioPlayer } from "../widget/AudioPlayer";
import { Form } from "../widget/Form";
import { Singletons } from "../Singletons";
import { Constants as C} from "../Constants";
import { PubSub } from "../PubSub";
import { DialogBase } from "../DialogBase";

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
 */
export class AudioPlayerDlg extends DialogBase {

    audioPlayer: AudioPlayer;
    playButton: Button;

    //DO NOT DELETE
    // private node: J.NodeInfo;

    constructor(private sourceUrl: string) {
        super("Audio Player");

        this.setChildren([
            new Form(null, [
                //new TextContent(this.title), 
                this.audioPlayer = new AudioPlayer({
                    src: this.sourceUrl,
                    style: {
                        width: "100%",
                        padding: "0px",
                        marginTop: "0px",
                        marginLeft: "0px",
                        marginRight: "0px"
                    },
                    onTimeUpdate: () => { S.podcast.onTimeUpdate(this); },
                    onCanPlay: () => { S.podcast.onCanPlay(this); },
                    controls: "controls",
                    autoPlay: "autoplay",
                    preload: "auto"
                }),
                new ButtonBar([
                    this.playButton = new Button("Play", this.playButtonFunction, null, "btn-primary"),
                    new Button("Close", this.closeBtn)
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
        ]);
    }

    getAudioElement(): HTMLAudioElement {
        let elm: HTMLAudioElement = this.audioPlayer.getAudioElement();
        if (elm == null) {
            console.log("not able to find audio element: " + this.audioPlayer.getId());
        }
        return elm;
    }

    /* When the dialog closes we need to stop and remove the player */
    cancel(): void {
        //console.log("AudioPlayerDialog cancel()");
        //todo-2: need to check over, and document flow of this function as it relates to calling "podcast.destroyPlayer(this);"
        this.close();
        let player = this.audioPlayer.getAudioElement();
        if (player) {

            /* audio player needs to be accessed like it's an array ?? Used to be the case, but checking again. */
            //(<any>player[0]).pause();
            console.log("player pause and remove");
            player.pause();
            player.remove();
        }
    }

    updatePlayButtonText = (): void => {
        let player = this.audioPlayer.getAudioElement();
        if (player) {
            this.playButton.setText(player.paused || player.ended ? "Play" : "Pause");
        }
    }

    playButtonFunction = (): void => {
        let player = this.audioPlayer.getAudioElement();
        if (player) {
            if (player.paused || player.ended) {
                S.podcast.play();
            }
            else {
                S.podcast.pause();
            }
            this.updatePlayButtonText();
        }
    }

    speed2Button = (): void => {
        S.podcast.speed(2);
    }

    speed15Button = (): void => {
        S.podcast.speed(1.5);
    }

    normalSpeedButton = (): void => {
        S.podcast.speed(1.0);
    }

    skipBack30Button = (): void => {
        S.podcast.skip(-30);
    }

    skipForward30Button = (): void => {
        S.podcast.skip(30);
    }

    closeEvent = (): void => {
        S.podcast.destroyPlayer(null);
    }

    closeBtn = (): void => {
        S.podcast.destroyPlayer(this);
    }

    init = (): void => {
        this.audioPlayer.whenElm((elm: HTMLAudioElement) => {
            S.podcast.player = elm;
            setTimeout(this.updatePlayButtonText, 1000);
        });
    }
}
