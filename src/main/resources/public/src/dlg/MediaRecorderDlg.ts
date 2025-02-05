import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { Selection } from "../comp/core/Selection";
import { VideoPlayer } from "../comp/core/VideoPlayer";
import { Constants as C } from "../Constants";
import { DialogBase, DialogMode } from "../DialogBase";
import { S } from "../Singletons";
import { Tailwind } from "../Tailwind";
import { AudioPlayerDlg } from "./AudioPlayerDlg";
import { ConfirmDlg } from "./ConfirmDlg";
import { VideoPlayerDlg } from "./VideoPlayerDlg";

// https://developers.google.com/web/fundamentals/media/recording-audio
// Need to persist in LOCAL browser storage which input selections (audio/video) are the current
// choice at all times.

// todo-2: there should be a cleaner way to get this MediaRecorder
declare const MediaRecorder: any;

interface LS { // Local State
    status?: string;
    recording?: boolean;
    audioInput?: string;
    videoInput?: string;
    audioInputOptions?: any[];
    videoInputOptions?: any[];
}

export class MediaRecorderDlg extends DialogBase {
    stream: any;
    chunks: any[] = [];
    recorder: any;

    // this timer is also used as a way to detect if we are currently recording. This will be null
    // always if not currently recording.
    recordingTimer: any;
    recordingTime: number = 0;
    continuable: boolean = false;
    status: Div;

    videoPlayer: VideoPlayer;

    public blob: Blob;
    public blobType: string;
    public uploadRequested: boolean;
    public recorded: boolean;

    constructor(public videoMode: boolean, private allowSave: boolean) {
        super(videoMode ? "Video Recorder" : "Audio Recorder", "appModalContNarrowWidth");
        this.mergeState<LS>({
            status: "",
            recording: false
        });
    }

    override async preLoad(): Promise<void> {
        await this.initDevices();
    }

    async initDevices() {
        try {
            await this.scanDevices();
            await this.resetStream();
        }
        catch (e) {
            console.log("Can't access recording devices, or user refused.");
            // just close this dialog if we can't access recording devices.
            // this.abort();
        }
    }

    async scanDevices() {
        const audioInputOptions: any[] = [];
        const videoInputOptions: any[] = [];

        let audioInput: string = await S.localDB.getVal(C.LOCALDB_AUDIO_SOURCE);
        let videoInput: string = await S.localDB.getVal(C.LOCALDB_VIDEO_SOURCE);

        // We have to call this first in case it would ask the user for permission.
        await navigator.mediaDevices.getUserMedia(this.videoMode ? { audio: true, video: true } : { audio: true });
        const devices: MediaDeviceInfo[] = await navigator.mediaDevices.enumerateDevices();

        devices.forEach(device => {
            // console.log("Device: Kind=" + device.kind + " Label=" + device.label);
            if (device.kind === "audioinput") {
                // take the first one here
                if (!audioInput) {
                    audioInput = device.deviceId;
                    S.localDB.setVal(C.LOCALDB_AUDIO_SOURCE, audioInput);
                }

                // add to data for dropdown
                audioInputOptions.push({ key: device.deviceId, val: device.label });
            }
            else if (device.kind === "videoinput") {

                // take the first one here
                if (!videoInput) {
                    videoInput = device.deviceId;
                    S.localDB.setVal(C.LOCALDB_VIDEO_SOURCE, videoInput);
                }

                // add to data for dropdown
                videoInputOptions.push({ key: device.deviceId, val: device.label });
            }
        });
        this.mergeState<LS>({ audioInput, videoInput, audioInputOptions, videoInputOptions });
    }

    renderDlg(): Comp[] {
        const state: any = this.getState<LS>();

        // This creates the video display showing just the live feed of the camera always,
        // regardless of whether currently recrding.
        if (this.videoMode) {
            if (!state.videoInputOptions?.length) {
                return [new Div("No video input device available yet.", { className: Tailwind.alertDanger })];
            }
            this.videoPlayer = new VideoPlayer({
                style: {
                    width: "100%",
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

            /* this is required to get the video live after every re-render, but I really need to
            learn react 'refs' to do this slightly cleaner without a onMount. We have to call this
            even if we didn't just create the video element because react can unmount the old one
            during re-renders. */
            this.displayStream();
        }
        else {
            if (!state.audioInputOptions?.length) {
                return [new Div("No audio input device available yet.", { className: Tailwind.alertDanger })];
            }
        }

        const audioSelect = new Selection(null, "Audio", state.audioInputOptions, "mt-3", {
            setValue: (val: string) => {
                S.localDB.setVal(C.LOCALDB_AUDIO_SOURCE, val);
                this.mergeState<LS>({ audioInput: val });
                setTimeout(() => {
                    this.resetStream();
                }, 250);
            },
            getValue: (): string => this.getState<LS>().audioInput
        });

        let videoSelect = null;
        if (this.videoMode) {
            videoSelect = new Selection(null, "Video", state.videoInputOptions, "mt-3", {
                setValue: (val: string) => {
                    S.localDB.setVal(C.LOCALDB_VIDEO_SOURCE, val);
                    this.mergeState<LS>({ videoInput: val });

                    setTimeout(() => {
                        this.resetStream();
                    }, 250);
                },
                getValue: (): string => this.getState<LS>().videoInput
            });
        }

        return [
            new Div(null, null, [
                this.status = state.status ? new Div(state.status, { className: Tailwind.alertInfo + " largerFont" }) : null,
                new ButtonBar([
                    state.recording ? null : new Button(this.allowSave ? "New Recording" : "Start Recording", this._newRecording, null, "-primary"),

                    // This didn't work for video (only audio) which actually means my wild guess to
                    // just combine chunks isn't the correct way to accomplish this, and so I"m just
                    // disabling it until I have time to research.
                    // state.recording || !this.continuable ? null : new Button("Continue Recording", this.continueRecording, null),

                    state.recording ? new Button("Stop", this._stop) : null,
                    state.recording || !this.continuable ? null : new Button("Play", this._play),
                    (!this.allowSave || (state.recording || !this.continuable)) ? null : new Button("Save", this._save),
                    new Button(this.allowSave ? "Cancel" : "Close", this._cancel, null, "float-right")
                ], "mt-3"),
                this.videoMode ? this.videoPlayer : null,
                new Div(null, { className: "mt-3" }, [audioSelect, videoSelect])
            ])
        ];
    }

    async resetStream() {
        try {
            this._stop();

            // stop() doesn't always nullify 'recorder' but we do it here. Any time stream is changing
            // we force it to recreate the recorder object.
            this.recorder = null;

            const state = this.getState<LS>();
            const constraints: any = { audio: { deviceId: state.audioInput } };
            if (this.videoMode) {
                constraints.video = { deviceId: state.videoInput };
            }

            this._closeStream();
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);

            if (this.videoMode) {
                this.displayStream();
            }
        }
        catch (e) {
        }
    }

    _newRecording = () => {
        this.recorded = true;
        this.chunks = [];
        this.continueRecording();
    }

    async continueRecording() {
        if (!this.recorder) {
            // I experimented with passing mimeTypes to Chrome and only the webm one seems to be
            // supported, so we don't need these options. May be smarter to just let the browser use
            // it's default anyway for all sorts of other reasons. Note: Browser can set to:
            // "video/webm;codecs=vp8,opus", which is only valid mime after truncating at ';' char.
            // let options = { mimeType: "audio/ogg" };
            // this.recorder = new MediaRecorder(this.stream, options);
            this.recorder = new MediaRecorder(this.stream);

            this.recorder.addEventListener("dataavailable", (event: any) => {
                this.chunks.push(event.data);
            });

            this.recorder.addEventListener("stop", () => {
                this.blob = new Blob(this.chunks, { type: this.chunks[0].type });
                this.blobType = this.chunks[0].type;
            });
        }

        this.recorder.start();
        this.recordingTime = 0;

        this.mergeState<LS>({ status: this.videoMode ? "Recording Video..." : "Recording Audio...", recording: true });
        this.recordingTimer = setInterval(this._recordingTimeslice, 1000);
    }

    displayStream() {
        if (this.videoPlayer && this.stream) {
            this.videoPlayer.onMount((elm: HTMLElement) => {
                (elm as HTMLVideoElement).srcObject = this.stream;
            });
        }
    }

    _recordingTimeslice = () => {
        document.getElementById(this.status.getId()).innerHTML = (this.videoMode ? "Recording Video: " : "Recording Audio: ") + (++this.recordingTime) + "s";
    }

    override preUnmount(): any {
        this.cancelTimer();
    }

    cancelTimer() {
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
    }

    // stop recording
    _stop = () => {
        if (!this.recordingTimer) return;
        this.continuable = true;
        this.cancelTimer();
        this.mergeState<LS>({ status: null, recording: false });
        if (this.recorder) {
            this.recorder.stop();
        }
    }

    _play = () => {
        if (this.recordingTimer) return;
        this.cancelTimer();
        this._stop();

        if (this.blob) {
            const url = URL.createObjectURL(this.blob);

            if (this.videoMode) {
                new VideoPlayerDlg("recorder", url, null, DialogMode.POPUP).open();
            }
            else {
                new AudioPlayerDlg(url).open();
            }
        }
    }

    _cleanup = () => {
        this.blob = null;
        this.recorder = null;
    }

    _closeStream = () => {
        this.stream?.getTracks().forEach((track: any) => track.stop());
    }

    _cancel = async () => {
        if (this.recorded) {
            const dlg = new ConfirmDlg("Abandon the current recording?", "Abandon Recording",
                "-danger", Tailwind.alertDanger);
            await dlg.open();
            if (dlg.yes) {
                this.cancelImmediate();
            }
        }
        else {
            this.cancelImmediate();
        }
    }

    override closeByUser() {
        super.closeByUser();
        this.stopAndCleanupVideo();
    }

    stopAndCleanupVideo() {
        this.cancelTimer();
        this._stop();
        this._closeStream();
        this._cleanup();
    }

    cancelImmediate() {
        this.stopAndCleanupVideo();
        this.close();
    }

    _save = () => {
        this._stop();
        this._closeStream();
        this.cancelTimer();
        this.uploadRequested = true;
        this.close();
    }
}
