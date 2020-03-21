import { DialogBase } from "../DialogBase";
import { ConfirmDlg } from "./ConfirmDlg";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { Div } from "../widget/Div";
import { Form } from "../widget/Form";
import { Constants as C, Constants } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

declare var Dropzone;

export class UploadFromFileDropzoneDlg extends DialogBase {

    hiddenInputContainer: Div;
    uploadButton: Button;

    fileList: any[] = null;
    zipQuestionAnswered: boolean = false;
    explodeZips: boolean = false;
    dropzone: any = null;
    dropzoneDiv: Div = null;
    sent: boolean = false;

    constructor(private toIpfs: boolean) {
        super(toIpfs ? "Upload File to IPFS" : "Upload File");

        this.setChildren([
            new Form(null, [
                this.dropzoneDiv = new Div("", { className: "dropzone" }),
                this.hiddenInputContainer = new Div(null, { style: { display: "none" } }),
                new ButtonBar([
                    this.uploadButton = new Button("Upload", this.upload, null, "btn-primary"),
                    new Button("Close", () => {
                        this.close();
                    })
                ])
            ])
        ]);

        this.uploadButton.setVisible(false);
    }

    upload = (): void => {
        if (this.filesAreValid()) {
            this.dropzone.processQueue();
            this.close();
        }
    }

    configureDropZone = (): void => {
        let dlg = this;
        let endpoint = this.toIpfs ? "uploadToIpfs" : "upload"
        let config: Object = {
            action: S.util.getRpcPath() + endpoint,
            width: "100%",
            height: "100%",
            progressBarWidth: '100%',
            url: S.util.getRpcPath() + "upload",
            // Prevents Dropzone from uploading dropped files immediately
            autoProcessQueue: false,
            paramName: "files",
            maxFilesize: Constants.MAX_UPLOAD_MB,
            parallelUploads: 2,

            /* Not sure what's this is for, but the 'files' parameter on the server is always NULL, unless
            the uploadMultiple is false */
            uploadMultiple: false,
            addRemoveLinks: true,
            dictDefaultMessage: "Click Here to Add Files (or Drag & Drop)",
            hiddenInputContainer: "#" + this.hiddenInputContainer.getId(),

            //ref: https://www.dropzonejs.com/#event-list

            // WARNING: Don't try to put arrow functions in here, these functions are called by Dropzone itself and the 
            // 'this' that is in scope during each call must be left as is.
            init: function () {
                this.on("addedfile", function (file) {
                    if (file.size > Constants.MAX_UPLOAD_MB * Constants.ONE_MB) {
                        S.util.showMessage("File is too large. Max Size=" + Constants.MAX_UPLOAD_MB + "MB");
                        return;
                    }
                    dlg.updateFileList(this);
                    dlg.runButtonEnablement();
                });

                this.on("maxfilesexceeded", function (arg) {
                    S.util.showMessage("Too many files.");
                });

                this.on("removedfile", function () {
                    dlg.updateFileList(this);
                    dlg.runButtonEnablement();
                });

                this.on("sending", function (file, xhr, formData) {
                    this.sent = true;
                    formData.append("nodeId", S.attachment.uploadNode.id);
                    formData.append("explodeZips", dlg.explodeZips ? "true" : "false");
                    formData.append("ipfs", dlg.toIpfs ? "true" : "false");
                    dlg.zipQuestionAnswered = false;
                });

                this.on("queuecomplete", function (arg) {
                    if (this.sent) {
                        dlg.close();
                        S.meta64.refresh();
                    }
                });
            }
        };

        S.util.getElm(this.dropzoneDiv.getId(), (elm: HTMLElement) => {
            this.dropzone = new Dropzone("#" + this.dropzoneDiv.getId(), config);
        });
    }

    updateFileList = (dropzoneEvt: any): void => {
        this.fileList = dropzoneEvt.getAddedFiles();
        this.fileList = this.fileList.concat(dropzoneEvt.getQueuedFiles());

        /* Detect if any ZIP files are currently selected, and ask user the question about whether they
        should be extracted automatically during the upload, and uploaded as individual nodes
        for each file */
        if (!this.zipQuestionAnswered && this.hasAnyZipFiles()) {
            this.zipQuestionAnswered = true;
            new ConfirmDlg("Do you want Zip files exploded onto the tree when uploaded?",
                "Explode Zips?", //
                //yes function
                () => {
                    this.explodeZips = true;
                },
                //no function
                () => {
                    this.explodeZips = false;
                }
            ).open();
        }
    }

    filesAreValid = (): boolean => {
        if (!this.fileList || this.fileList.length == 0) {
            return false;
        }

        for (let file of this.fileList) {
            if (file.size > Constants.MAX_UPLOAD_MB * Constants.ONE_MB) {
                return false;
            }
        }
        return true;
    }

    hasAnyZipFiles = (): boolean => {
        let ret: boolean = false;
        for (let file of this.fileList) {
            if (S.util.endsWith(file["name"].toLowerCase(), ".zip")) {
                return true;
            }
        }
        return ret;
    }

    runButtonEnablement = (): void => {
        let valid = this.filesAreValid();

        //todo-1: why does setEnabled work just fine but setVisible doesn't work?
        this.uploadButton.setEnabled(valid);
    }

    init = (): void => {
        this.configureDropZone();
        this.runButtonEnablement();
    }
}
