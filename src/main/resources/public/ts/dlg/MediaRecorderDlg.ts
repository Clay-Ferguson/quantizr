import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Form } from "../widget/Form";
import { Heading } from "../widget/Heading";
import { VideoPlayer } from "../widget/VideoPlayer";
import { AudioPlayerDlg } from "./AudioPlayerDlg";
import { VideoPlayerDlg } from "./VideoPlayerDlg";
import { Selection } from "../widget/Selection";
import { Div } from "../widget/Div";
import clientInfo from "../ClientInfo";

// https://developers.google.com/web/fundamentals/media/recording-audio

declare var MediaRecorder;

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

// check with: MediaRecorder.isTypeSupported('video/webm;codecs=vp8');
//
// From StackOverflow.com
// video/webm
// video/webm;codecs=vp8
// video/webm;codecs=vp9
// video/webm;codecs=vp8.0
// video/webm;codecs=vp9.0
// video/webm;codecs=h264
// video/webm;codecs=H264
// video/webm;codecs=avc1
// video/webm;codecs=vp8,opus
// video/WEBM;codecs=VP8,OPUS
// video/webm;codecs=vp9,opus
// video/webm;codecs=vp8,vp9,opus
// video/webm;codecs=h264,opus
// video/webm;codecs=h264,vp9,opus
// audio/webm
// audio/webm;codecs=opus
//
// https://developer.mozilla.org/en-US/docs/Web/Media/Formats/codecs_parameter
//
// audio/mpeg
// audio/ogg
// audio/mp4
// audio/webm
//
// video/ogg
// video/mp4
// video/webm

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

    constructor(state: AppState, public videoMode: boolean) {
        super(videoMode ? "Video Recorder" : "Audio Recorder", null, false, state);
        this.mergeState({
            status: "",
            recording: false
        });
    }

    preLoad(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            await this.scanDevices();
            await this.resetStream();
            resolve();
        });
    }

    scanDevices = async (): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {
            let audioInputOptions = [];
            let videoInputOptions = [];
            let audioInput = null;
            let videoInput = null;

            let devices: MediaDeviceInfo[] = await navigator.mediaDevices.enumerateDevices();

            devices.forEach((device: MediaDeviceInfo) => {
                if (device.kind === "audioinput") {
                    // take the first one here
                    if (!audioInput) {
                        audioInput = device.deviceId;
                    }

                    // add to data for dropdown
                    audioInputOptions.push({ key: device.deviceId, val: device.label });
                }
                else if (device.kind === "videoinput") {

                    // take the first one here
                    if (!videoInput) {
                        videoInput = device.deviceId;
                    }

                    // add to data for dropdown
                    videoInputOptions.push({ key: device.deviceId, val: device.label });
                }
            });

            this.mergeState({ audioInput, videoInput, audioInputOptions, videoInputOptions });
            resolve();
        });
    }

    renderDlg(): CompIntf[] {
        let state: any = this.getState();

        // This creates the video display showing just the live feed of the camera always, regardless of whether currently recrding.
        if (this.videoMode) {
            this.videoPlayer = new VideoPlayer({
                style: {
                    width: clientInfo.isMobile ? "50%" : "100%",
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
                    state.recording ? null : new Button("New Recording", this.newRecording, null, "btn-primary"),

                    // This didn't work for video (only audio) which actually means my wild guess to just combine chunks isn't the correct way
                    // to accomplish this, and so I"m just disabling it until I have time to research.
                    // state.recording || !this.continuable ? null : new Button("Continue Recording", this.continueRecording, null),

                    state.recording ? new Button("Stop", this.stop, null) : null,
                    state.recording || !this.continuable ? null : new Button("Play", this.play, null),
                    state.recording || !this.continuable ? null : new Button("Save", this.save, null),
                    new Button("Cancel", this.cancel)
                ]),
                this.videoMode ? this.videoPlayer : null,
                new Div("", { className: "marginTop" }, [audioSelect, videoSelect])
            ])
        ];
    }

    resetStream = async () => {
        return new Promise<void>(async (resolve, reject) => {
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

            if (this.videoMode) {
                this.displayStream();
            }

            resolve();
        });
    }

    renderButtons(): CompIntf {
        return null;
    }

    newRecording = () => {
        this.chunks = [];
        this.continueRecording();
    }

    continueRecording = async () => {
        if (!this.recorder) {
            // I experimented with passing mimeTypes to Chrome and only the webm one seems to be supported, so we don't need
            // these options. May be smarter to just let the browser use it's default anyway for all sorts of other reasons.
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
            this.videoPlayer.whenElm((elm: HTMLVideoElement): void => {
                elm.srcObject = this.stream;
            });
        }
    }

    recordingTimeslice = () => {
        document.getElementById(this.status.getId()).innerHTML = (this.videoMode ? "Recording Video: " : "Recording Audio: ") + (++this.recordingTime) + "s";
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
                new VideoPlayerDlg(url, null, this.appState).open();
            }
            else {
                new AudioPlayerDlg(url, this.appState).open();
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

    cancel = (): void => {
        // todo-0: need confirmation here if they clicked the record button ever.
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
