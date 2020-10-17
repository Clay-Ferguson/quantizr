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

declare var MediaRecorder;

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class MediaRecorderDlg extends DialogBase {
    // recorder: any;
    audio: any;
    stream: any;
    chunks = [];
    mediaRecorder: any;
    recordingTimer: any;
    recordingTime: number = 0;
    continuable: boolean = false;
    status: Heading;

    public blob: Blob;
    public blobType: string;
    public uploadRequested: boolean;

    constructor(state: AppState, public videoMode: boolean) {
        super("Audio Recorder", null, false, state);
        this.mergeState({ status: "", recording: false });
    }

    renderDlg(): CompIntf[] {
        let state: any = this.getState();
        return [
            new Form(null, [
                new TextContent("Record directly from your device, then play back and/or upload the audio as an attachment."),
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

    newRecording = async () => {
        this.chunks = [];
        this.continueRecording();
    }

    continueRecording = async () => {
        if (!this.mediaRecorder) {

            let constraints: any = { audio: true };
            if (this.videoMode) {
                constraints.video = true;
            }

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.mediaRecorder = new MediaRecorder(this.stream);

            this.mediaRecorder.addEventListener("dataavailable", event => {
                this.chunks.push(event.data);
            });

            this.mediaRecorder.addEventListener("stop", () => {
                this.blob = new Blob(this.chunks, { type: this.chunks[0].type });
                this.blobType = this.chunks[0].type;
            });
        }

        this.mediaRecorder.start();
        this.recordingTime = 0;

        this.mergeState({ status: this.videoMode ? "Recording Video..." : "Recording Audio...", recording: true });
        this.recordingTimer = setInterval(() => {
            this.recordingTimeslice();
        }, 1000);
    }

    recordingTimeslice = () => {
        document.getElementById(this.status.getId()).innerHTML = this.videoMode ? "Recording Video:" : "Recording Audio: " + (++this.recordingTime) + "s";
    }

    cancelTimer = () => {
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
        }
    }

    stop = async () => {
        this.continuable = true;
        this.cancelTimer();
        this.mergeState({ status: "Paused", recording: false });
        if (this.mediaRecorder) {
            this.mediaRecorder.stop();
        }
    }

    play = async () => {
        this.cancelTimer();
        this.stop();

        if (this.blob) {
            const url = URL.createObjectURL(this.blob);

            if (this.videoMode) {
                let dlg = new VideoPlayerDlg(url, null, this.appState).open();
            }
            else {
                // DO NOT DELETE: This can play the audio without the dialog.
                // const audio = new Audio(audioUrl);
                // audio.play();
                let dlg = new AudioPlayerDlg(url, this.appState).open();
            }
        }
    }

    cleanup = (): void => {
        this.blob = null;
        this.mediaRecorder = null;
        this.audio = null;
    }

    closeStream = (): void => {
        this.stream.getTracks().forEach(function (track) {
            track.stop();
        });
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
