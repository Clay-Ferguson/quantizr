import { DialogBase } from "../DialogBase";
import { ConfirmDlg } from "./ConfirmDlg";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { Div } from "../widget/Div";
import { Form } from "../widget/Form";
import { Constants as C} from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";

let S : Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
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

    constructor(private toIpfs: boolean) {
        super(toIpfs ? "Upload File to IPFS" : "Upload File");
        
        this.setChildren([
            new Form(null, [
                this.dropzoneDiv = new Div("", {className: "dropzone"}),
                this.hiddenInputContainer = new Div(null, { style: {display: "none"} }),
                new ButtonBar([
                    this.uploadButton = new Button("Upload", this.upload, null, "btn-primary"),
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
            maxFilesize: 20, //<---put in a variable
            parallelUploads: 2,

            /* Not sure what's this is for, but the 'files' parameter on the server is always NULL, unless
            the uploadMultiple is false */
            uploadMultiple: false,
            addRemoveLinks: true,
            dictDefaultMessage: "Click Here to Add Files (or Drag & Drop)",
            hiddenInputContainer: "#" + this.hiddenInputContainer.getId(),

            // WARNING: Don't try to put arrow functions in here, these functions are called by Dropzone itself and the 
            // 'this' that is in scope during each call must be left as is.
            init: function () {
                this.on("addedfile", function (file) { 
                    if (file.size > 20 * 1024 * 1024) { //put number in variable (todo-0)
                        S.util.showMessage("File is too large. Max Size=20MB");
                        return;
                    }
                    dlg.updateFileList(this);
                    dlg.runButtonEnablement(this);
                });

                this.on("maxfilesexceeded", function(arg) {
                    debugger;
                    S.util.showMessage("File is too large. Max Size=20MB");
                });

                this.on("removedfile", function () {
                    debugger;
                    dlg.updateFileList(this);
                    dlg.runButtonEnablement(this);
                });

                this.on("sending", function (file, xhr, formData) {
                    debugger;
                    formData.append("nodeId", S.attachment.uploadNode.id);
                    formData.append("explodeZips", dlg.explodeZips ? "true" : "false");
                    formData.append("ipfs", dlg.toIpfs ? "true" : "false");
                    dlg.zipQuestionAnswered = false;
                });

                //todo-0: finish testing the case where user adds file that's too large

                this.on("queuecomplete", function (arg) {
                    debugger;
                    dlg.close();
                    S.meta64.refresh();
                });
            }
        };

        S.util.getElm(this.dropzoneDiv.getId(), (elm: HTMLElement) => {
            this.dropzone = new Dropzone("#" + this.dropzoneDiv.getId(), config);
        });
    }

    updateFileList = (dropzoneEvt: any): void => {
        debugger;
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
