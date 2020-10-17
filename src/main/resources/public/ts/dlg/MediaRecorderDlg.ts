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

declare var MediaRecorder;

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class MediaRecorderDlg extends DialogBase {
    // recorder: any;
    audio: any;
    chunks = [];
    mediaRecorder: any;
    recordingTimer: any;
    recordingTime: number = 0;
    continuable: boolean = false;

    public audioBlob: Blob;
    public blobType: string;
    public uploadRequested: boolean;

    constructor(state: AppState) {
        super("Audio Recorder", null, false, state);
        this.mergeState({ status: "", recording: false });
    }

    renderDlg(): CompIntf[] {
        let state: any = this.getState();
        return [
            new Form(null, [
                new TextContent("Record directly from your device, then play back and/or upload the audio as an attachment."),
                new Heading(1, state.status),
                new ButtonBar([
                    state.recording ? null : new Button("New Recording", this.newRecording, null, "btn-primary"),
                    state.recording || !this.continuable ? null : new Button("Continue Recording", this.continueRecording, null),
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
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);

            this.mediaRecorder.addEventListener("dataavailable", event => {
                this.chunks.push(event.data);
            });

            this.mediaRecorder.addEventListener("stop", () => {
                this.audioBlob = new Blob(this.chunks, { type: this.chunks[0].type });
                this.blobType = this.chunks[0].type;
            });
        }

        this.mediaRecorder.start();
        this.recordingTime = 0;

        this.mergeState({ status: "Recording your Mic...", recording: true });

        // This update every second works fine BUT there is a noticeable risk that you can click a button
        // during a react render, and it can ignore the click, so if/when we bring this back it will need to be an
        // ordinary javascript DOM update (non-react)
        // this.recordingTimeslice();
        // this.recordingTimer = setInterval(() => {
        //     this.recordingTimeslice();
        // }, 1000);
    }

    recordingTimeslice = () => {
        this.mergeState({ status: "Recording: " + (this.recordingTime++) + "s", recording: true });
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

        if (this.audioBlob) {
            const audioUrl = URL.createObjectURL(this.audioBlob);
            // DO NOT DELETE: This can play the audio without the dialog.
            // const audio = new Audio(audioUrl);
            // audio.play();
            let dlg = new AudioPlayerDlg(audioUrl, this.appState);
            dlg.open();
        }
    }

    cleanup = (): void => {
        this.audioBlob = null;
        this.mediaRecorder = null;
        this.audio = null;
    }

    cancel = (): void => {
        this.cancelTimer();
        this.stop();
        this.cleanup();
        this.close();
    }

    save = (): void => {
        this.stop();
        this.cancelTimer();
        this.uploadRequested = true;
        this.close();
    }
}
