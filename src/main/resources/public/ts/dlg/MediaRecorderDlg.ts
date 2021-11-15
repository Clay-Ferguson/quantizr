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
import { Form } from "../widget/Form";
import { Heading } from "../widget/Heading";
import { Selection } from "../widget/Selection";
import { VideoPlayer } from "../widget/VideoPlayer";
import { AudioPlayerDlg } from "./AudioPlayerDlg";
import { ConfirmDlg } from "./ConfirmDlg";
import { VideoPlayerDlg } from "./VideoPlayerDlg";

// https://developers.google.com/web/fundamentals/media/recording-audio
// Need to persist in LOCAL browser storage which input selections (audio/video) are the current choice at all times.

declare var MediaRecorder;

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});
export class MediaRecorderDlg extends DialogBase {
    stream: any;
    chunks = [];
    recorder: any;

    // this timer is also used as a way to detect if we are currently recording. This will be null always if not currently recording.
    recordingTimer: any;
    recordingTime: number = 0;
    continuable: boolean = false;
    status: Heading;

    videoPlayer: VideoPlayer;

    public blob: Blob;
    public blobType: string;
    public uploadRequested: boolean;
    public recorded: boolean;

    constructor(state: AppState, public videoMode: boolean, private allowSave: boolean) {
        super(videoMode ? "Video Recorder" : "Audio Recorder", null, false, state);
        this.mergeState({
            status: "",
            recording: false
        });
    }

    async preLoad(): Promise<void> {
        try {
            await this.scanDevices();
            await this.resetStream();
        }
        catch (e) {
            console.log("Can't access recording devices, or user refused.");
            // just close this dialog if we can't access recording devices.
            this.abort();
        }
    }

    scanDevices = async (): Promise<void> => {
        let audioInputOptions = [];
        let videoInputOptions = [];

        let audioInput: string = await S.localDB.getVal(C.LOCALDB_AUDIO_SOURCE);
        let videoInput: string = await S.localDB.getVal(C.LOCALDB_VIDEO_SOURCE);

        let devices: MediaDeviceInfo[] = await navigator.mediaDevices.enumerateDevices();

        devices.forEach((device: MediaDeviceInfo) => {
            if (device.kind === "audioinput") {
                // take the first one here
                if (!audioInput) {
                    audioInput = device.deviceId;
                    S.localDB.setVal(C.LOCALDB_AUDIO_SOURCE, audioInput, this.appState.userName);
                }

                // add to data for dropdown
                audioInputOptions.push({ key: device.deviceId, val: device.label });
            }
            else if (device.kind === "videoinput") {

                // take the first one here
                if (!videoInput) {
                    videoInput = device.deviceId;
                    S.localDB.setVal(C.LOCALDB_VIDEO_SOURCE, videoInput, this.appState.userName);
                }

                // add to data for dropdown
                videoInputOptions.push({ key: device.deviceId, val: device.label });
            }
        });

        this.mergeState({ audioInput, videoInput, audioInputOptions, videoInputOptions });

        /* if videoMode and we don't have at least one audio and video input then abort */
        if (this.videoMode) {
            if (audioInputOptions.length === 0 && videoInputOptions.length === 0) {
                this.abort();
            }
        }
        /* if audio mode and we don't have at least one audio input then abort */
        else {
            if (audioInputOptions.length === 0) {
                this.abort();
            }
        }
    }

    renderDlg(): CompIntf[] {
        let state: any = this.getState();

        // This creates the video display showing just the live feed of the camera always, regardless of whether currently recrding.
        if (this.videoMode) {
            this.videoPlayer = new VideoPlayer({
                style: {
                    width: this.appState.mobileMode ? "50%" : "100%",
                    border: "3px solid gray",
                    display: "block",
                    padding: "0px",
                    marginTop: "8px",
                    marginLeft: "0px",
                    marginRight: "0px"
                },
                // "ontimeupdate": () => { S.podcast.onTimeUpdate(this); },
                // "oncanplay": () => { S.podcast.onCanPlay(this); },
                // controls: "controls",
                autoPlay: "autoplay",
                muted: true
                // "volume": "0.9",
                // "preload": "auto"
            });

            /* this is required to get the video live after every re-render, but I really need to learn react 'refs'
            to do this slightly cleaner without a whenElm. We have to call this even if we didn't just create
            the video element because react can unmount the old one during re-renders. */
            this.displayStream();
        }

        let audioSelect = new Selection(null, "Audio", state.audioInputOptions, "mediaStreamInputOption", "", {
            setValue: (val: string): void => {
                S.localDB.setVal(C.LOCALDB_AUDIO_SOURCE, val, this.appState.userName);
                this.mergeState({ audioInput: val });
                setTimeout(() => {
                    this.resetStream();
                }, 250);
            },
            getValue: (): string => {
                return this.getState().audioInput;
            }
        });

        let videoSelect = null;
        if (this.videoMode) {
            videoSelect = new Selection(null, "Video", state.videoInputOptions, "mediaStreamInputOption", "", {
                setValue: (val: string): void => {
                    S.localDB.setVal(C.LOCALDB_VIDEO_SOURCE, val, this.appState.userName);
                    this.mergeState({ videoInput: val });

                    setTimeout(() => {
                        this.resetStream();
                    }, 250);
                },
                getValue: (): string => {
                    return this.getState().videoInput;
                }
            });
        }

        return [
            new Form(null, [
                this.status = new Heading(2, state.status),
                new ButtonBar([
                    state.recording ? null : new Button(this.allowSave ? "New Recording" : "Start Recording", this.newRecording, null, "btn-primary"),

                    // This didn't work for video (only audio) which actually means my wild guess to just combine chunks isn't the correct way
                    // to accomplish this, and so I"m just disabling it until I have time to research.
                    // state.recording || !this.continuable ? null : new Button("Continue Recording", this.continueRecording, null),

                    state.recording ? new Button("Stop", this.stop, null) : null,
                    state.recording || !this.continuable ? null : new Button("Play", this.play, null),
                    (!this.allowSave || (state.recording || !this.continuable)) ? null : new Button("Save", this.save, null),
                    new Button(this.allowSave ? "Cancel" : "Close", this.cancel)
                ], "marginTop"),
                this.videoMode ? this.videoPlayer : null,
                new Div("", { className: "marginTop" }, [audioSelect, videoSelect])
            ])
        ];
    }

    resetStream = async () => {
        try {
            this.stop();

            // stop() doesn't always nullify 'recorder' but we do it here. Any time stream is changing
            // we force it to recreate the recorder object.
            this.recorder = null;

            let state = this.getState();
            let constraints: any = { audio: { deviceId: state.audioInput } };
            if (this.videoMode) {
                constraints.video = { deviceId: state.videoInput };
            }

            this.closeStream();
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            if (!this.stream) {
                this.abort();
            }

            if (this.videoMode) {
                this.displayStream();
            }
        }
        catch (e) {
            this.abort();
        }
    }

    newRecording = () => {
        this.recorded = true;
        this.chunks = [];
        this.continueRecording();
    }

    continueRecording = async () => {
        if (!this.recorder) {
            // I experimented with passing mimeTypes to Chrome and only the webm one seems to be supported, so we don't need
            // these options. May be smarter to just let the browser use it's default anyway for all sorts of other reasons.
            // Note: Browser can set to: "video/webm;codecs=vp8,opus", which is only valid mime after truncating at ';' char.
            // let options = { mimeType: "audio/ogg" };
            // this.recorder = new MediaRecorder(this.stream, options);
            this.recorder = new MediaRecorder(this.stream);

            this.recorder.addEventListener("dataavailable", event => {
                this.chunks.push(event.data);
            });

            this.recorder.addEventListener("stop", () => {
                this.blob = new Blob(this.chunks, { type: this.chunks[0].type });
                this.blobType = this.chunks[0].type;
            });
        }

        this.recorder.start();
        this.recordingTime = 0;

        this.mergeState({ status: this.videoMode ? "Recording Video..." : "Recording Audio...", recording: true });
        this.recordingTimer = setInterval(() => {
            this.recordingTimeslice();
        }, 1000);
    }

    displayStream = () => {
        if (this.videoPlayer && this.stream) {
            this.videoPlayer.whenElm((elm: HTMLElement): void => {
                (elm as HTMLVideoElement).srcObject = this.stream;
            });
        }
    }

    recordingTimeslice = () => {
        document.getElementById(this.status.getId()).innerHTML = (this.videoMode ? "Recording Video: " : "Recording Audio: ") + (++this.recordingTime) + "s";
    }

    preUnmount(): any {
        this.cancelTimer();
    }

    cancelTimer = () => {
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
    }

    // stop recording
    stop = () => {
        if (!this.recordingTimer) return;
        this.continuable = true;
        this.cancelTimer();
        this.mergeState({ status: "Paused", recording: false });
        if (this.recorder) {
            this.recorder.stop();
        }
    }

    play = () => {
        if (this.recordingTimer) return;
        this.cancelTimer();
        this.stop();

        if (this.blob) {
            const url = URL.createObjectURL(this.blob);

            if (this.videoMode) {
                new VideoPlayerDlg("recorder", url, null, DialogMode.POPUP, this.appState).open();
            }
            else {
                new AudioPlayerDlg(null, null, null, url, 0, this.appState).open();
            }
        }
    }

    cleanup = (): void => {
        this.blob = null;
        this.recorder = null;
    }

    closeStream = (): void => {
        if (this.stream) {
            this.stream.getTracks().forEach(function (track) {
                track.stop();
            });
        }
    }

    cancel = async (): Promise<void> => {
        if (this.recorded) {
            let dlg: ConfirmDlg = new ConfirmDlg("Abandon the current recording?", "Abandon Recording",
                "btn-danger", "alert alert-danger", this.appState);
            await dlg.open();
            if (dlg.yes) {
                this.cancelImmediate();
            }
        }
        else {
            this.cancelImmediate();
        }
    }

    cancelImmediate = (): void => {
        this.cancelTimer();
        this.stop();
        this.closeStream();
        this.cleanup();
        this.close();
    }

    save = (): void => {
        this.stop();
        this.closeStream();
        this.cancelTimer();
        this.uploadRequested = true;
        this.close();
    }
}
