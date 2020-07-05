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
import { AppState } from "../AppState";
import { CompIntf } from "../widget/base/CompIntf";
import { Checkbox } from "../widget/Checkbox";
import { HorizontalLayout } from "../widget/HorizontalLayout";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

declare var Dropzone;

export class UploadFromFileDropzoneDlg extends DialogBase {

    //TEMPORAL_HOST: string = "https://dev.api.temporal.cloud";
    TEMPORAL_HOST: string = "https://api.temporal.cloud";

    hiddenInputContainer: Div;
    uploadButton: Button;

    fileList: any[] = null;
    zipQuestionAnswered: boolean = false;
    explodeZips: boolean = false;
    dropzone: any = null;
    dropzoneDiv: Div = null;
    sent: boolean = false;

    /* If this is true we upload directly to temporal rather than routing thru Quanta */
    toTemporal: boolean = true;
    temporalToken: string = null;
    temporalUsr: string;
    temporalPwd: string;

    //storing this in a var was a quick convenient hack, but I need to get it probably from parmaeters closer to the fucntions using the value.
    ipfsFile: File;

    maxFiles: number = 50;

    //this varible gets set if anything is detected wrong during the upload
    uploadFailed: boolean = false;
    errorShown: boolean = false;

    constructor(private nodeId: string, private node: J.NodeInfo, toIpfs: boolean, private autoAddFile: File, private importMode: boolean, state: AppState, public afterUploadFunc: Function) {
        super(importMode ? "Import File" : "Upload File", null, false, state);
        this.mergeState({ toIpfs });
    }

    renderDlg(): CompIntf[] {
        let state = this.getState();
        let children = [
            new Form(null, [
                new HorizontalLayout([
                    new Checkbox("Save to IPFS", state.toIpfs, {
                        onClick: this.toggleIpfs,
                    })
                ]),
                state.toIpfs ? new TextContent("NOTE: IPFS Uploads assume you have a Temporal Account (https://temporal.cloud) which will be the service that hosts your IPFS data. You'll be prompted for the Temporal password when the upload begins.") : null,
                this.dropzoneDiv = new Div("", { className: "dropzone" }),
                this.hiddenInputContainer = new Div(null, { style: { display: "none" } }),
                new ButtonBar([
                    this.uploadButton = new Button("Upload", this.upload, null, "btn-primary"),
                    new Button("Upload from URL", this.uploadFromUrl,
                        state.toIpfs ? new Button("IPFS Credentials", () => { this.getTemporalCredentials(true); }, null, "btn-primary") : null),
                    new Button("Close", () => {
                        this.close();
                    }),
                ]),
            ])
        ];

        this.uploadButton.setVisible(false);
        this.configureDropZone();
        this.runButtonEnablement();
        return children;
    }

    renderButtons(): CompIntf {
        return null;
    }

    toggleIpfs = (): void => {
        let state = this.getState();
        this.mergeState({
            toIpfs: !state.toIpfs
        });
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
                    username: this.temporalUsr,
                    password: this.temporalPwd
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

    uploadFromUrl = (): void => {
        let state = this.getState();
        S.attachment.openUploadFromUrlDlg(this.node, null, () => {
            this.close();

            if (this.afterUploadFunc) {
                this.afterUploadFunc();
            }
        }, state);
    }

    upload = async (): Promise<boolean> => {
        let state = this.getState();
        return new Promise<boolean>(async (resolve, reject) => {
            if (this.filesAreValid()) {
                let allowUpload = true;

                if (state.toIpfs && this.toTemporal) {
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
        let state = this.getState();
        let maxUploadSize = this.appState.userPreferences.maxUploadFileSize;

        /* Allow 20MB for Quanta uploads or 20GB for IPFS */
        let maxFileSize = (state.toIpfs && this.toTemporal) ? maxUploadSize * 1024 : maxUploadSize;

        let action;
        if (this.importMode) {
            action = S.util.getRpcPath() + "streamImport";
        }
        else {
            action = (state.toIpfs && this.toTemporal) ? (this.TEMPORAL_HOST + "/v2/ipfs/public/file/add") :
                S.util.getRpcPath() + "upload";
        }
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
            paramName: (state.toIpfs && dlg.toTemporal) ? "file" : "files",
            maxFilesize: maxFileSize,
            parallelUploads: 50,

            //Without this the client will make multiple calls to the server to upload
            //each file instead of streaming them all at once in an array of files.
            uploadMultiple: true,

            maxFiles: this.maxFiles,

            addRemoveLinks: true,
            dictDefaultMessage: "Click Here to Add Files (or Drag & Drop)",
            hiddenInputContainer: "#" + this.hiddenInputContainer.getId(),

            //ref: https://www.dropzonejs.com/#event-list

            // WARNING: Don't try to put arrow functions in here, these functions are called by Dropzone itself and the 
            // 'this' that is in scope during each call must be left as is.
            init: function () {
                this.on("addedfile", function (file) {
                    dlg.uploadFailed = false;
                    dlg.errorShown = false;
                    if (!dlg.toTemporal && (file.size > maxUploadSize * Constants.ONE_MB)) {
                        S.util.showMessage("File is too large. Max Size=" + maxUploadSize + "MB", "Warning");
                        return;
                    }
                    dlg.updateFileList(this);
                    dlg.runButtonEnablement();
                });

                this.on("maxfilesexceeded", function (arg) {
                    S.util.showMessage("Only " + dlg.maxFiles + " file can be uploaded to a node.", "Warning");
                });

                this.on("removedfile", function () {
                    dlg.updateFileList(this);
                    dlg.runButtonEnablement();
                });

                this.on("sending", function (file: File, xhr, formData) {
                    dlg.sent = true;
                    /* If Uploading DIRECTLY to Temporal.cloud */
                    if (state.toIpfs && dlg.toTemporal) {
                        dlg.ipfsFile = file;
                        //todo-0: check if temporal supports multiple uploads? 
                        formData.append("file", file);
                        formData.append("hold_time", "1");

                        xhr.withCredentials = false;
                        xhr.setRequestHeader("Cache-Control", "no-cache");
                        xhr.setRequestHeader("Authorization", "Bearer " + dlg.temporalToken);
                    }
                    /* Else we'll be uploading onto Quanta and saving to ipfs based on the 'ipfs' flag */
                    else {
                        console.log("Sending File: " + file.name);
                        formData.append("files", file);

                        //It's important to check before calling append on this formData, because when uploading multiple files
                        //when this runs for the second, third, etc file it ends up createing 
                        //nodeId as a comma delimted list which is wrong.
                        if (!formData.has("nodeId")) {
                            formData.append("nodeId", dlg.nodeId);
                            formData.append("explodeZips", dlg.explodeZips ? "true" : "false");
                            formData.append("ipfs", state.toIpfs ? "true" : "false");
                        }
                    }
                    dlg.zipQuestionAnswered = false;
                });

                this.on("error", function (param1, param2, param3) {
                    if (dlg.sent) {
                        dlg.uploadFailed = true;
                        S.util.showMessage("Upload failed.", "Warning");
                    }
                });

                this.on("success", function (param1, resp, param3) {
                    //todo-0: get rid of the tight coupling to an exception class name here. This was a quick fix/hack
                    if (!resp.succese && resp.exceptionClass && resp.exceptionClass.endsWith(".OutOfSpaceException")) {
                        if (!dlg.errorShown) {
                            dlg.errorShown = true;
                            dlg.uploadFailed = true;
                            S.util.showMessage("Upload failed. You're out of storage space on the server. \n\nConsider uploading to IPFS using Temporal (https://temporal.cloud)", "Warning");
                        }
                        return;
                    }
                    //console.log("Uploaded to Hash: " + ipfsHash);

                    //https://developer.mozilla.org/en-US/docs/Web/API/File
                    if (dlg.ipfsFile) {
                        let ipfsHash = resp.response;

                        /* delete the BIN property if it's there. Can't have BIN and IPFS_LINK at same time. */
                        S.props.setNodePropVal(J.NodeProp.BIN, dlg.node, "[null]");

                        S.props.setNodePropVal(J.NodeProp.IPFS_LINK, dlg.node, ipfsHash);
                        S.props.setNodePropVal(J.NodeProp.BIN_MIME, dlg.node, dlg.ipfsFile.type);
                        S.props.setNodePropVal(J.NodeProp.BIN_SIZE, dlg.node, `${dlg.ipfsFile.size}`);
                        S.props.setNodePropVal(J.NodeProp.BIN_FILENAME, dlg.node, dlg.ipfsFile.name);

                        S.util.ajax<J.SaveNodeRequest, J.SaveNodeResponse>("saveNode", {
                            node: dlg.node
                        }, (res) => {
                            S.edit.saveNodeResponse(dlg.node, res, dlg.appState);
                        });
                    }
                });

                this.on("queuecomplete", function (arg) {
                    if (dlg.sent) {
                        if (dlg.fileList && dlg.fileList.length > 1) {
                            if (!dlg.uploadFailed) {
                                S.util.showMessage("The " + dlg.fileList.length + " uploads were added as sub-nodes of the current node. Open this node to view them.", "Note");
                            }
                        }

                        dlg.close();
                        if (dlg.afterUploadFunc) {
                            dlg.afterUploadFunc();
                        }
                    }
                });
            }
        };

        S.util.getElm(this.dropzoneDiv.getId(), (elm: HTMLElement) => {
            this.dropzone = new Dropzone("#" + this.dropzoneDiv.getId(), config);
            let maxUploadSize = this.appState.userPreferences.maxUploadFileSize;

            if (this.autoAddFile) {
                if (!dlg.toTemporal && (this.autoAddFile.size > maxUploadSize * Constants.ONE_MB)) {
                    S.util.showMessage("File is too large. Max Size=" + maxUploadSize + "MB", "Warning");
                    return;
                }

                /* It took me forever to figure out that 'addFile' can do this here, I'm not sure if it's undocumented or
                could be taken away some day. Hopefully not. */
                this.dropzone.addFile(this.autoAddFile);
            }
        });
    }

    updateFileList = (dropzoneEvt: any): void => {
        this.fileList = dropzoneEvt.getAddedFiles();
        this.fileList = this.fileList.concat(dropzoneEvt.getQueuedFiles());

        /* Detect if any ZIP files are currently selected, and ask user the question about whether they
        should be extracted automatically during the upload, and uploaded as individual nodes
        for each file */
        if (!this.importMode && !this.zipQuestionAnswered && this.hasAnyZipFiles()) {
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
                }, null, null, this.appState
            ).open();
        }
    }

    filesAreValid = (): boolean => {
        let state = this.getState();
        if (!this.fileList || this.fileList.length == 0 || this.fileList.length > this.maxFiles) {
            return false;
        }

        let maxUploadSize = this.appState.userPreferences.maxUploadFileSize;
        let maxFileSizeMb = (state.toIpfs && this.toTemporal) ? maxUploadSize * 1024 : maxUploadSize;

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
                let dlg = new EditCredentialsDlg(forceEdit ? "Temporal Credentials" : "Temporal Account Login",
                    Constants.LOCALDB_TEMPORAL_USR, Constants.LOCALDB_TEMPORAL_PWD, this.appState);
                await dlg.open();
                this.temporalUsr = dlg.usr;
                this.temporalPwd = dlg.pwd;
            }
            resolve(!!this.temporalUsr && !!this.temporalPwd);
        });
    }
}
