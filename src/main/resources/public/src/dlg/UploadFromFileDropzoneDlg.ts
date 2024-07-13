import Dropzone from "dropzone";
import { getAs } from "../AppContext";
import { Constants as C, Constants } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { FlexLayout } from "../comp/core/FlexLayout";
import { IconButton } from "../comp/core/IconButton";
import { ConfirmDlg } from "./ConfirmDlg";
import { MediaRecorderDlg } from "./MediaRecorderDlg";

export class UploadFromFileDropzoneDlg extends DialogBase {
    hiddenInputContainer: Div;
    uploadButton: Button;
    fileList: any[] = null;
    zipQuestionAnswered: boolean = false;
    explodeZips: boolean = false;
    dropzone: any = null;
    dropzoneDiv: Div = null;
    sent: boolean = false;
    maxFiles: number = 50;

    // this varible gets set if anything is detected wrong during the upload
    uploadFailed: boolean = false;
    errorShown: boolean = false;
    numFiles: number = 0;

    /* We allow either nodeId or 'node' to be passed in here */
    constructor(private nodeId: string, private attName: string, //
        private autoAddFile: File, private importMode: boolean, public allowRecording: boolean, //
        public afterUploadFunc: () => void, private showAdvancedOptions: boolean) {
        super(importMode ? "Import File" : "Attach File");
    }

    renderDlg(): Comp[] {
        const children = [
            new Div(null, null, [
                this.showAdvancedOptions ? this.buildSourcesComponent() : null,

                new Div("From your Computer (Click Below or Drag-and-Drop)", { className: "marginTop" }),

                // WARNING: Keep these static IDs here, because when the page rerenders dropzone
                // knows these IDs and dropzone will malfunction if these IDs change.
                this.dropzoneDiv = new Div("", { id: "dropzone", className: "dropzone" }),
                this.hiddenInputContainer = new Div(null, { id: "dropzoneInput", style: { display: "none" } }),

                new ButtonBar([
                    this.uploadButton = new Button(this.importMode ? "Import" : "Upload", this.upload, null, "btn-primary"),
                    new Button("Close", this.close, null, "btn-secondary float-end")
                ], "marginTop")
            ])
        ];

        this.configureDropZone();
        this.runButtonEnablement();
        return children;
    }

    buildSourcesComponent = (): Comp => {
        if (this.importMode) return null;

        return new FlexLayout([
            new Div(null, { className: "marginRight" }, [
                new Div("Existing Data"),
                new ButtonBar([
                    !S.util.clipboardReadable() ? null : new IconButton("fa-clipboard", "Clipboard", {
                        onClick: this.uploadFromClipboard,
                        title: "Upload from Clipboard"
                    }),

                    new IconButton("fa-cloud", "URL", {
                        onClick: this.uploadFromUrl,
                        title: "Upload from Web/URL"
                    }),
                ])
            ]),
            new Div(null, { className: "marginRight" }, [
                new Div("Live Recording"),
                new ButtonBar([
                    !this.allowRecording ? null : new IconButton("fa-microphone", "Mic", {
                        onClick: async () => {
                            const dlg: MediaRecorderDlg = new MediaRecorderDlg(false, true);
                            await dlg.open();
                            if (dlg.uploadRequested) {
                                this.dropzone.addFile(new File([dlg.blob], "audio-recording.opus", { type: dlg.blobType }));
                                this.runButtonEnablement();
                                this.upload();
                            }
                        },
                        title: "Record Audio as Attachment"
                    }),

                    !this.allowRecording ? null : new IconButton("fa-video-camera", "Webcam", {
                        onClick: async () => {
                            const dlg: MediaRecorderDlg = new MediaRecorderDlg(true, true);
                            await dlg.open();
                            if (dlg.uploadRequested) {
                                // Convert a string like: "video/webm;codecs=vp8,opus" to just the mime part.
                                dlg.blobType = S.util.chopAtLastChar(dlg.blobType, ";");
                                this.dropzone.addFile(new File([dlg.blob], "video-recording.webm", { type: dlg.blobType }));
                                this.runButtonEnablement();
                                this.upload();
                            }
                        },
                        title: "Record Video as Attachment"
                    })
                ])
            ])
        ]);
    }

    uploadFromClipboard = async () => {
        const blob = await S.util.readClipboardFile();
        if (blob) {
            this.immediateUploadFiles([blob]);
        }
        else {
            S.util.showMessage("Unable to get Clipboard content.", "Warning");
        }
    }

    immediateUploadFiles = async (files: File[]) => {
        const ast = getAs();
        await S.domUtil.uploadFilesToNode(files, ast.editNode?.id, false);
        this.close();
        if (this.afterUploadFunc) {
            this.afterUploadFunc();
        }
    }

    uploadFromUrl = () => {
        S.attachment.openUploadFromUrlDlg(this.nodeId, () => {
            this.close();
            if (this.afterUploadFunc) {
                this.afterUploadFunc();
            }
        });
    }

    upload = async (): Promise<boolean> => {
        if (this.filesAreValid()) {
            const files = this.dropzone.getAcceptedFiles();
            if (files) {
                this.numFiles = files.length;
                if (this.numFiles) {
                    S.rpcUtil.startBlockingProcess();
                    this.dropzone.processQueue();
                }
            }
        }
        return true;
    }

    configureDropZone = () => {
        /* Limit based on user quota for our user accounts */
        const maxFileSize = getAs().userPrefs.maxUploadFileSize;

        let action;
        if (this.importMode) {
            action = S.rpcUtil.getRpcPath() + "streamImport";
        }
        else {
            action = S.rpcUtil.getRpcPath() + "upload";
        }
        const url = action;

        // we assign 'dlg' as 'this' because the 'this' below is controlled and called by 3rd party
        // code expecting 'this' to be what the dropzoned lib needs.
        const dlg = this;

        const config: any = {
            action,
            width: "100%",
            height: getAs().mobileMode ? "60%" : "100%",
            progressBarWidth: "100%",
            url,
            headers: {
                Bearer: S.quanta.authToken || "",
                Sig: S.crypto.userSignature || ""
            },
            // Prevents Dropzone from uploading dropped files immediately
            autoProcessQueue: false,
            paramName: "files",
            maxFilesize: maxFileSize,

            parallelUploads: 20,

            // Flag tells server to upload multiple files using multi-post requests so more than one file is allowed for each post it makes.
            uploadMultiple: true,

            maxFiles: this.maxFiles,

            addRemoveLinks: true,
            dictDefaultMessage: "Add", // we have dz-message hidden actually so this has no effect.
            hiddenInputContainer: "#" + this.hiddenInputContainer.getId(),

            // ref: https://www.dropzonejs.com/#event-list

            // WARNING: Don't try to put arrow functions in here, these functions are called by Dropzone itself and the
            // 'this' that is in scope during each call must be left as is.
            init: function () {
                this.on("addedfile", function (file: any) {
                    dlg.uploadFailed = false;
                    dlg.errorShown = false;
                    if (file.size > maxFileSize * Constants.ONE_MB) {
                        S.util.showMessage("File is too large. Max Size=" + maxFileSize + "MB", "Warning");
                        return;
                    }
                    dlg.updateFileList(this);
                    dlg.runButtonEnablement();
                });

                this.on("maxfilesexceeded", function (_arg: any) {
                    S.util.showMessage("Only " + dlg.maxFiles + " file can be uploaded to a node.", "Warning");
                });

                this.on("removedfile", function () {
                    dlg.updateFileList(this);
                    dlg.runButtonEnablement();
                });

                this.on("sending", function (file: File, _xhr: any, formData: any) {
                    dlg.sent = true;
                    formData.append("files", file);

                    // It's important to check before calling append on this formData, because when uploading multiple files
                    // when this runs for the second, third, etc file it ends up createing
                    // nodeId as a comma delimted list which is wrong.
                    if (!formData.has("nodeId")) {
                        formData.append("nodeId", dlg.nodeId);
                        formData.append("attName", dlg.attName);
                        formData.append("explodeZips", dlg.explodeZips ? "true" : "false");
                    }

                    dlg.zipQuestionAnswered = false;
                });

                this.on("error", function (_param1: any, _param2: any, _param3: any) {
                    S.rpcUtil.stopBlockingProcess();
                    if (dlg.sent) {
                        dlg.uploadFailed = true;
                        S.util.showMessage("Upload failed (4)", "Warning");
                    }
                });

                // not needed (this does work however)
                // this.on("uploadprogress", function (_file: any, progress: any) {
                //     console.log("File progress: " + progress);
                // });

                this.on("success", function (_file: File, resp: J.ResponseBase, _evt: ProgressEvent) {
                    if (resp.code != C.RESPONSE_CODE_OK) {
                        if (!dlg.errorShown) {
                            dlg.errorShown = true;
                            dlg.uploadFailed = true;

                            let msg = "Upload Complete."
                            if (resp.code == C.RESPONSE_CODE_OUTOFSPACE) {
                                msg += " You're out of storage space.";
                            }
                            else {
                                if (resp.message) {
                                    msg += " " + resp.message;
                                }
                            }

                            S.util.showMessage(msg, "Warning");
                        }
                        return;
                    }
                });

                this.on("queuecomplete", function (_arg: any) {
                    S.rpcUtil.stopBlockingProcess();
                    if (dlg.sent) {
                        dlg.close();
                        if (dlg.afterUploadFunc) {
                            dlg.afterUploadFunc();
                        }
                    }
                });
            }
        };

        this.dropzoneDiv.domPreUpdateEvent = (): void => {
            this.dropzone = new Dropzone("#" + this.dropzoneDiv.getId(), config);
            const maxUploadSize = getAs().userPrefs.maxUploadFileSize;

            if (this.autoAddFile) {
                if (this.autoAddFile.size > maxUploadSize * Constants.ONE_MB) {
                    S.util.showMessage("File is too large. Max Size=" + maxUploadSize + "MB", "Warning");
                    return;
                }

                /* It took me forever to figure out that 'addFile' can do this here, I'm not sure if it's undocumented or
                could be taken away some day. Hopefully not. */
                this.dropzone.addFile(this.autoAddFile);

                // let's click the upload button too, automatically
                setTimeout(this.upload, 250);
            }
        }
    }

    updateFileList = async (dropzoneEvt: any) => {
        this.fileList = dropzoneEvt.getAddedFiles();
        this.fileList = this.fileList.concat(dropzoneEvt.getQueuedFiles());

        /* Detect if any ZIP files are currently selected, and ask user the question about whether they
        should be extracted automatically during the upload, and uploaded as individual nodes
        for each file */
        if (!this.importMode && !this.zipQuestionAnswered && this.hasAnyZipFiles()) {
            this.zipQuestionAnswered = true;
            const dlg = new ConfirmDlg("Do you want Zip files exploded onto the tree when uploaded?",
                "Explode Zips?");

            await dlg.open();
            this.explodeZips = dlg.yes;
        }
    }

    filesAreValid = (): boolean => {
        if (!this.fileList || this.fileList.length === 0 || this.fileList.length > this.maxFiles) {
            return false;
        }

        const maxFileSizeMb = getAs().userPrefs.maxUploadFileSize;
        for (const file of this.fileList) {
            if (file.size > maxFileSizeMb * Constants.ONE_MB) {
                return false;
            }
        }
        return true;
    }

    hasAnyZipFiles = (): boolean => {
        return this.fileList.some(file => file.name?.toLowerCase().endsWith(".zip"));
    }

    runButtonEnablement = () => {
        const valid = this.filesAreValid();
        this.uploadButton.setEnabled(valid);
    }
}
