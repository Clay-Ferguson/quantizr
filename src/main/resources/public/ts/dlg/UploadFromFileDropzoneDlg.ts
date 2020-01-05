import { DialogBase } from "../DialogBase";
import { ConfirmDlg } from "./ConfirmDlg";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { TextContent } from "../widget/TextContent";
import { Div } from "../widget/Div";
import { Form } from "../widget/Form";
import { Constants } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";

let S : Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

declare var Dropzone;

export class UploadFromFileDropzoneDlg extends DialogBase {

    hiddenInputContainer: Div;
    uploadButton: Button;

    fileList: Object[] = null;
    zipQuestionAnswered: boolean = false;
    explodeZips: boolean = false;
    dropzone: any = null;
    dropzoneDiv: Div = null;

    constructor() {
        super("Upload File");
        
        this.setChildren([
            new Form(null, [
                Constants.SHOW_PATH_IN_DLGS ? new TextContent("Path: " + S.attachment.uploadNode.path, "path-display-in-editor") : null,
                this.dropzoneDiv = new Div("", {className: "dropzone"}),
                this.hiddenInputContainer = new Div(null, { style: {display: "none"} }),
                new ButtonBar([
                    this.uploadButton = new Button("Upload", this.upload),
                    new Button("Close", () => {
                        this.close();
                    })
                ])
            ])
        ]);
    }

    upload = (): void => {
        this.dropzone.processQueue();
        this.close();
    }

    configureDropZone = (): void => {
        let dlg = this;
        let config: Object = {
            action: S.util.getRpcPath() + "upload",
            width: 500,
            height: 500,
            progressBarWidth: '100%',
            zIndex: 100,
            url: S.util.getRpcPath() + "upload",
            // Prevents Dropzone from uploading dropped files immediately
            autoProcessQueue: false,
            paramName: "files",
            maxFilesize: 20, //<---- I assume this is in MB ?
            parallelUploads: 2,

            /* Not sure what's this is for, but the 'files' parameter on the server is always NULL, unless
            the uploadMultiple is false */
            uploadMultiple: false,
            addRemoveLinks: true,
            dictDefaultMessage: "Drag & Drop files here, or Click",
            hiddenInputContainer: "#" + this.hiddenInputContainer.getId(),

            init: function () {
                let dropzone = this; // closure

                this.on("addedfile", function () {
                    dlg.updateFileList(this);
                    dlg.runButtonEnablement(this);
                });

                this.on("removedfile", function () {
                    dlg.updateFileList(this);
                    dlg.runButtonEnablement(this);
                });

                this.on("sending", function (file, xhr, formData) {
                    formData.append("nodeId", S.attachment.uploadNode.id);
                    formData.append("explodeZips", dlg.explodeZips ? "true" : "false");
                    dlg.zipQuestionAnswered = false;
                });

                this.on("queuecomplete", function (file) {
                    dlg.close();
                    S.meta64.refresh();
                });
            }
        };

        S.dom.whenElm(this.dropzoneDiv.getId(), (elm) => {
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

    hasAnyZipFiles = (): boolean => {
        let ret: boolean = false;
        for (let file of this.fileList) {
            if (S.util.endsWith(file["name"].toLowerCase(), ".zip")) {
                return true;
            }
        }
        return ret;
    }

    runButtonEnablement = (dropzoneEvt: any): void => {
        let filesSelected = dropzoneEvt.getAddedFiles().length > 0 ||
            dropzoneEvt.getQueuedFiles().length > 0;
        this.uploadButton.setVisible(filesSelected);
    }

    init = (): void => {
        this.configureDropZone();
    }
}
