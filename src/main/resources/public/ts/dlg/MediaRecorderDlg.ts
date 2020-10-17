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
import { TextContent } from "../widget/TextContent";
import { AudioPlayerDlg } from "./AudioPlayerDlg";
import { VideoPlayerDlg } from "./VideoPlayerDlg";

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

    public blob: Blob;
    public blobType: string;
    public uploadRequested: boolean;

    constructor(state: AppState, public videoMode: boolean) {
        super(videoMode ? "Video Recorder" : "Audio Recorder", null, false, state);
        this.mergeState({ status: "", recording: false });
    }

    renderDlg(): CompIntf[] {
        let state: any = this.getState();
        return [
            new Form(null, [
                new TextContent("Records from your device, to upload as an attachment."),
                this.status = new Heading(1, state.status),
                new ButtonBar([
                    state.recording ? null : new Button("New Recording", this.newRecording, null, "btn-primary"),

                    // This didn't work for video (only audio) which actually means my wild guess to just combine chunks isn't the correct way
                    // to accomplish this, and so I"m just disabling it until I have time to research.
                    // state.recording || !this.continuable ? null : new Button("Continue Recording", this.continueRecording, null),

                    state.recording ? new Button("Stop", this.stop, null) : null,
                    state.recording || !this.continuable ? null : new Button("Play", this.play, null),
                    state.recording || !this.continuable ? null : new Button("Save", this.save, null),
                    new Button("Cancel", this.cancel)
                ])
            ])
        ];
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

            let constraints: any = { audio: true };
            if (this.videoMode) {
                constraints.video = true;
            }

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);

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

    recordingTimeslice = () => {
        document.getElementById(this.status.getId()).innerHTML = (this.videoMode ? "Recording Video: " : "Recording Audio: ") + (++this.recordingTime) + "s";
    }

    cancelTimer = () => {
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
    }

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
