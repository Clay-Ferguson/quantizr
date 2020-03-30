import * as J from "../JavaIntf";
import { DialogBase } from "../DialogBase";
import { ConfirmDlg } from "./ConfirmDlg";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { Div } from "../widget/Div";
import { Form } from "../widget/Form";
import { Constants as C, Constants } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { EditCredentialsDlg } from "./EditCredentialsDlg";
import { TextContent } from "../widget/TextContent";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

declare var Dropzone;

export class UploadFromFileDropzoneDlg extends DialogBase {

    //todo-0: change back to 'prod' soon.
    TEMPORAL_HOST: string = "https://dev.api.temporal.cloud";

    hiddenInputContainer: Div;
    uploadButton: Button;

    fileList: any[] = null;
    zipQuestionAnswered: boolean = false;
    explodeZips: boolean = false;
    dropzone: any = null;
    dropzoneDiv: Div = null;
    sent: boolean = false;

    /* If this is true we upload directly to temporal rather than routing thru Quantizr */
    toTemporal: boolean = true;
    temporalToken: string = null;
    temporalUsr: string;
    temporalPwd: string;

    //storing this in a var was a quick convenient hack, but I need to get it probably from parmaeters closer to the fucntions using the value.
    ipfsFile: File;

    maxFiles: number = 1;

    constructor(private toIpfs: boolean) {
        super(toIpfs ? "Upload File to IPFS" : "Upload File");

        this.setChildren([
            new Form(null, [
                toIpfs ? new TextContent("NOTE: IPFS Uploads assume you have a Temporal Account (https://temporal.cloud) which will be the service that hosts your IPFS data. You'll be prompted for the Temporal password when the upload begins.") : null,
                this.dropzoneDiv = new Div("", { className: "dropzone" }),
                this.hiddenInputContainer = new Div(null, { style: { display: "none" } }),
                new ButtonBar([
                    this.uploadButton = new Button("Upload", this.upload, null, "btn-primary"),
                    this.toIpfs ? new Button("IPFS Credentials", () => { this.getTemporalCredentials(true); }, null, "btn-primary") : null,
                    new Button("Close", () => {
                        this.close();
                    })
                ])
            ])
        ]);

        this.uploadButton.setVisible(false);
    }

    //ref: https://gateway.temporal.cloud/ipfs/Qma4DNFSRR9eGqwm93zMUtqywLFpTRQji4Nnu37MTmNntM/account.html#account-api
    temporalLogin = async (): Promise<boolean> => {
        return new Promise<boolean>(async (resolve, reject) => {
            if (!this.temporalUsr || !this.temporalPwd) {
                console.error("No temporal credentials available.");
                return;
            }

            fetch(this.TEMPORAL_HOST + '/v2/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain'
                },
                body: JSON.stringify({
                    "username": this.temporalUsr,
                    "password": this.temporalPwd
                })
            })//
                .then(res => res.json())//
                .catch(error => {
                    console.error(error);
                    resolve(false);
                    if (error) {
                        throw error;
                    }
                })//
                .then(response => {
                    //Why is this checking for expire ? (this came from the Temporal.cloud example)
                    if (response.expire) {
                        this.temporalToken = response.token;
                        console.log(response.token.toString());
                        resolve(true);
                    }
                    // Error handling here.
                })//
                .catch(error => {
                    console.error('#' + error)
                    resolve(false);
                });
        });
    }

    upload = async (): Promise<boolean> => {
        return new Promise<boolean>(async (resolve, reject) => {
            if (this.filesAreValid()) {
                let allowUpload = true;

                if (this.toIpfs && this.toTemporal) {
                    let credsOk = await this.getTemporalCredentials(false);
                    if (!credsOk) {
                        resolve(false);
                    }
                    let loginOk = await this.temporalLogin();
                    if (!loginOk) {
                        allowUpload = false;
                    }
                }

                if (allowUpload) {
                    //this.uploadToTemporal(); //<--- original upload prototype (works)
                    this.dropzone.processQueue();
                    this.close();
                }
            }
            resolve(true);
        });
    }

    //ref: https://gateway.temporal.cloud/ipns/docs.api.temporal.cloud/ipfs.html#example
    /**
     * DEAD CODE (method) - But leave this here.
     * 
     * I'm leaving this method here, for future reference, or examples, and it was the first working code I had
     * before integrating these upload parameters into the Dropzone config to let dropzone do the uploaing to Temporal.
     */
    uploadToTemporal = (): void => {
        if (this.temporalToken) {
            console.error("Temporal login never completed.");
        }

        let file = this.fileList[0];
        let data = new FormData();
        data.append("file", file);
        data.append("hold_time", "1");

        let xhr = new XMLHttpRequest();
        xhr.withCredentials = false;

        xhr.addEventListener("readystatechange", function () {
            if (xhr.readyState === 4) {
                console.log(S.util.prettyPrint(xhr));
                let result = JSON.parse(xhr.responseText);

                if (result.code === 200) {
                    console.log("Upload Result: " + result);
                }
                else {
                    // Error handling.
                    console.error("upload failed.");
                }
            }
        }.bind(this));

        xhr.open("POST", this.TEMPORAL_HOST + "/v2/ipfs/public/file/add");
        xhr.setRequestHeader("Cache-Control", "no-cache");
        xhr.setRequestHeader("Authorization", "Bearer " + this.temporalToken);
        xhr.send(data);
    }

    configureDropZone = (): void => {

        /* Allow 20MB for Quantizr uploads or 20GB for IPFS */
        let maxFileSize = (this.toIpfs && this.toTemporal) ? Constants.MAX_UPLOAD_MB * 1024 : Constants.MAX_UPLOAD_MB;

        let action = (this.toIpfs && this.toTemporal) ? (this.TEMPORAL_HOST + "/v2/ipfs/public/file/add") :
            S.util.getRpcPath() + "upload";
        let url = action;

        let dlg = this;
        let config: Object = {
            action,
            width: "100%",
            height: "100%",
            progressBarWidth: '100%',
            url,
            // Prevents Dropzone from uploading dropped files immediately
            autoProcessQueue: false,
            paramName: (dlg.toIpfs && dlg.toTemporal) ? "file" : "files", 
            maxFilesize: maxFileSize,
            parallelUploads: 2,

            /* Not sure what's this is for, but the 'files' parameter on the server is always NULL, unless
            the uploadMultiple is false */
            uploadMultiple: false,

            maxFiles: this.maxFiles,

            addRemoveLinks: true,
            dictDefaultMessage: "Click Here to Add Files (or Drag & Drop)",
            hiddenInputContainer: "#" + this.hiddenInputContainer.getId(),

            //ref: https://www.dropzonejs.com/#event-list

            // WARNING: Don't try to put arrow functions in here, these functions are called by Dropzone itself and the 
            // 'this' that is in scope during each call must be left as is.
            init: function () {
                this.on("addedfile", function (file) {
                    if (!dlg.toTemporal && (file.size > Constants.MAX_UPLOAD_MB * Constants.ONE_MB)) {
                        S.util.showMessage("File is too large. Max Size=" + Constants.MAX_UPLOAD_MB + "MB");
                        return;
                    }
                    dlg.updateFileList(this);
                    dlg.runButtonEnablement();
                });

                this.on("maxfilesexceeded", function (arg) {
                    S.util.showMessage("Only " + dlg.maxFiles + " file can be uploaded to a node.");
                });

                this.on("removedfile", function () {
                    dlg.updateFileList(this);
                    dlg.runButtonEnablement();
                });

                this.on("sending", function (file: File, xhr, formData) {
                    dlg.sent = true;
                    /* If Uploading DIRECTLY to Temporal.cloud */
                    if (dlg.toIpfs && dlg.toTemporal) {
                        dlg.ipfsFile = file;
                        formData.append("file", file);
                        formData.append("hold_time", "1");

                        xhr.withCredentials = false;
                        xhr.setRequestHeader("Cache-Control", "no-cache");
                        xhr.setRequestHeader("Authorization", "Bearer " + dlg.temporalToken);
                    }
                    /* Else we'll be uploading onto Quantizr and saving to ipfs based on the 'ipfs' flag */
                    else {
                        formData.append("nodeId", S.attachment.uploadNode.id);
                        formData.append("explodeZips", dlg.explodeZips ? "true" : "false");
                        formData.append("ipfs", dlg.toIpfs ? "true" : "false");
                    }
                    dlg.zipQuestionAnswered = false;
                });

                this.on("error", function (param1, param2, param3) {
                    if (dlg.sent) {
                        S.util.showMessage("Upload failed.");
                    }
                    //todo-1: This can fail if the data is already saved and has a hash.
                    //UPDATE: There was already an issue filed for this. need to doublecheck that the hash isn't actually being sent back
                    //already and maybe I just wasning seeing it for some reason.
                });

                this.on("success", function (param1, param2, param3) {
                    //console.log("Uploaded to Hash: " + ipfsHash);

                    //https://developer.mozilla.org/en-US/docs/Web/API/File
                    if (dlg.ipfsFile) {
                        let ipfsHash = param2.response;

                        S.props.setNodePropVal(J.NodeProp.IPFS_LINK, S.attachment.uploadNode, ipfsHash);
                        S.props.setNodePropVal(J.NodeProp.BIN_MIME, S.attachment.uploadNode, dlg.ipfsFile.type);
                        S.props.setNodePropVal(J.NodeProp.BIN_SIZE, S.attachment.uploadNode, `${dlg.ipfsFile.size}`);
                        S.props.setNodePropVal(J.NodeProp.BIN_FILENAME, S.attachment.uploadNode, dlg.ipfsFile.name);

                        S.util.ajax<J.SaveNodeRequest, J.SaveNodeResponse>("saveNode", {
                            node: S.attachment.uploadNode
                        }, (res) => {
                            S.edit.saveNodeResponse(S.attachment.uploadNode, res);
                        });
                    }
                });

                this.on("queuecomplete", function (arg) {
                    if (dlg.sent) {
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
        if (!this.fileList || this.fileList.length == 0 || this.fileList.length > this.maxFiles) {
            return false;
        }

        let maxFileSizeMb = (this.toIpfs && this.toTemporal) ? Constants.MAX_UPLOAD_MB * 1024 : Constants.MAX_UPLOAD_MB;

        for (let file of this.fileList) {
            if (file.size > maxFileSizeMb * Constants.ONE_MB) {
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

    getTemporalCredentials = async (forceEdit: boolean): Promise<boolean> => {
        return new Promise<boolean>(async (resolve, reject) => {
            this.temporalUsr = await S.localDB.getVal(Constants.LOCALDB_TEMPORAL_USR);
            this.temporalPwd = await S.localDB.getVal(Constants.LOCALDB_TEMPORAL_PWD);

            if (forceEdit || (!this.temporalUsr || !this.temporalPwd)) {
                let dlg = new EditCredentialsDlg(forceEdit ? "Temporal Credentials" : "Temporal Account Login", Constants.LOCALDB_TEMPORAL_USR, Constants.LOCALDB_TEMPORAL_PWD);
                await dlg.open();
                this.temporalUsr = dlg.usr;
                this.temporalPwd = dlg.pwd;
            }
            resolve(!!this.temporalUsr && !!this.temporalPwd);
        });
    }

    init = (): void => {
        this.configureDropZone();
        this.runButtonEnablement();
    }
}
