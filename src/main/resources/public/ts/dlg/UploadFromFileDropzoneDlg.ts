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
    maxFiles: number = 50;

    //this varible gets set if anything is detected wrong during the upload
    uploadFailed: boolean = false;
    errorShown: boolean = false;
    numFiles: number = 0;

    constructor(private nodeId: string, private node: J.NodeInfo, toIpfs: boolean, private autoAddFile: File, private importMode: boolean, state: AppState, public afterUploadFunc: Function) {
        super(importMode ? "Import File" : "Upload File", null, false, state);
        this.mergeState({ toIpfs });
    }

    renderDlg(): CompIntf[] {
        let state = this.getState();
        //S.log("upload.renderDlg: state.toIpfs="+state.toIpfs);
        let children = [
            new Form(null, [
                new HorizontalLayout([
                    new Checkbox("Save to IPFS", null, {
                        setValue: (checked: boolean): void => {
                            this.mergeState({ toIpfs: checked });
                        },
                        getValue: (): boolean => {
                            return this.getState().toIpfs;
                        }
                    })
                ]),
                state.toIpfs ? new TextContent("NOTE: IPFS Uploads assume you have a Temporal Account (https://temporal.cloud) which will be the service that hosts your IPFS data. You'll be prompted for the Temporal password when the upload begins.") : null,
                this.dropzoneDiv = new Div("", { className: "dropzone" }),
                this.hiddenInputContainer = new Div(null, { style: { display: "none" } }),
                new ButtonBar([
                    this.uploadButton = new Button("Upload", this.upload, null, "btn-primary"),
                    new Button("Upload from URL", this.uploadFromUrl),
                    new Button("Upload from Clipboard", this.uploadFromClipboard),
                    state.toIpfs ? new Button("IPFS Credentials", () => { S.ipfsUtil.getTemporalCredentials(true); }) : null,
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

    uploadFromUrl = (): void => {
        let state = this.getState();
        S.attachment.openUploadFromUrlDlg(this.node, null, () => {
            this.close();

            if (this.afterUploadFunc) {
                this.afterUploadFunc();
            }
        }, state);
    }

    // https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/read
    // https://web.dev/image-support-for-async-clipboard/
    // Linux Ubuntu note: Shift + Ctrl + PrtSc -> Copy the screenshot of a specific region to the clipboard.
    // todo-1: I have a feature that pastes from clipboard to a node as text, but it needs to detect images and if image is in
    // clipboard create a node and put that image in it.
    uploadFromClipboard = (): void => {
        (navigator as any).clipboard.read().then(async (data) => {
            for (const clipboardItem of data) {
                for (const type of clipboardItem.types) {
                    const blob = await clipboardItem.getType(type);
                    //console.log(URL.createObjectURL(blob));

                    // DO NOT DELETE: The 'addedfile' emit may be the better way ? not sure yet. addFile() does work.
                    // this.dropzone.emit("addedfile", blob);
                    // //myDropzone.emit("thumbnail", existingFiles[i], "/image/url");
                    // this.dropzone.emit("complete", blob);

                    this.dropzone.addFile(blob);
                    this.runButtonEnablement();
                }
            }
        });
    }

    upload = async (): Promise<boolean> => {
        let state = this.getState();
        return new Promise<boolean>(async (resolve, reject) => {
            if (this.filesAreValid()) {
                let allowUpload = true;

                if (state.toIpfs && this.toTemporal) {
                    let loginOk = await S.ipfsUtil.temporalLogin();
                    if (!loginOk) {
                        allowUpload = false;
                    }
                }

                if (allowUpload) {
                    const files = this.dropzone.getAcceptedFiles();
                    this.numFiles = files.length;

                    //NOTE: Either the for loop OR the processQueue will always for actually for non-ipfs uploads, but for uploading to 
                    //IPFS we know we do need to manually force it to process one file at a time to comply with what temporal.cloud allows.
                    if (state.toIpfs) {
                        if (files.length > 0) {
                            files.forEach((file: File) => {
                                //S.log("Dropzone Processing File: " + file.name);
                                this.dropzone.processFile(file)
                            });
                        }
                    } else {
                        this.dropzone.processQueue();
                    }
                }
            }
            resolve(true);
        });
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
            action = (state.toIpfs && this.toTemporal) ? (C.TEMPORAL_HOST + "/v2/ipfs/public/file/add") :
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

            //sets max number to send in each request, to keep from overloading server when large numbers are being sent
            //to break up the upload into batches, but still sends each batch as a multi-file post.
            parallelUploads: state.toIpfs ? 1 : 20,

            //Flag tells server to upload multiple files using multi-post requests so more than one file is allowed for each post it makes.
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
                        formData.append("file", file);
                        formData.append("hold_time", "1");

                        xhr.withCredentials = false;
                        xhr.setRequestHeader("Cache-Control", "no-cache");
                        xhr.setRequestHeader("Authorization", "Bearer " + S.ipfsUtil.temporalToken);
                    }
                    /* Else we'll be uploading onto Quanta and saving to ipfs based on the 'ipfs' flag */
                    else {
                        S.log("Sending File: " + file.name);
                        formData.append("files", file);

                        //It's important to check before calling append on this formData, because when uploading multiple files
                        //when this runs for the second, third, etc file it ends up createing 
                        //nodeId as a comma delimted list which is wrong.
                        if (!formData.has("nodeId")) {
                            formData.append("nodeId", dlg.nodeId);
                            formData.append("explodeZips", dlg.explodeZips ? "true" : "false");

                            //NOTE: This ipfs flag is *not* for the Temporal.cloud upload but is for the currently unused capability 
                            //Quanta platform has to run it's own gateway IPFS-GO instance (but currently we aren't running it)
                            formData.append("ipfs", state.toIpfs ? "true" : "false");

                            formData.append("createAsChildren", dlg.numFiles > 1 ? "true" : "false");
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

                this.on("success", function (file: File, resp: any, evt: ProgressEvent) {
                    //S.log("onSuccess: dlg.numFiles=" + dlg.numFiles);

                    //todo-1: get rid of the tight coupling to an exception class name here. This was a quick fix/hack
                    if (!resp.success && resp.exceptionClass && resp.exceptionClass.endsWith(".OutOfSpaceException")) {
                        if (!dlg.errorShown) {
                            dlg.errorShown = true;
                            dlg.uploadFailed = true;
                            S.util.showMessage("Upload failed. You're out of storage space on the server. \n\nConsider uploading to IPFS using Temporal (https://temporal.cloud)", "Warning");
                        }
                        return;
                    }
                    //S.log("Uploaded to Hash: " + ipfsHash);

                    //https://developer.mozilla.org/en-US/docs/Web/API/File
                    if (dlg.getState().toIpfs) {
                        let ipfsHash = resp.response;

                        //If we're uploading multipe files they all go in as children of the current node
                        //it's too late to check the count here. it may be down to one. need to get mutiFlag right when processing starts
                        if (dlg.numFiles > 1) {
                            let properties: J.PropertyInfo[] = [
                                { "name": J.NodeProp.BIN, value: "[null]" },
                                { "name": J.NodeProp.IPFS_LINK, value: ipfsHash },
                                { "name": J.NodeProp.BIN_MIME, value: file.type },
                                { "name": J.NodeProp.BIN_SIZE, value: `${file.size}` },
                                { "name": J.NodeProp.BIN_FILENAME, value: file.name },
                                { "name": J.NodeProp.IMG_SIZE, value: "100%" }
                            ];

                            S.util.ajax<J.CreateSubNodeRequest, J.CreateSubNodeResponse>("createSubNode", {
                                updateModTime: true,
                                nodeId: dlg.node.id,
                                newNodeName: "",
                                typeName: "u",
                                createAtTop: false,
                                content: file.name,
                                typeLock: false,
                                properties,
                            }, (res) => {
                                //nothing to be done here.
                            });
                        }
                        /* Otherwise add all the properties to this node to update it for the upload */
                        else {
                            /* delete the BIN property if it's there. Can't have BIN and IPFS_LINK at same time. */
                            S.props.setNodePropVal(J.NodeProp.BIN, dlg.node, "[null]");
                            S.props.setNodePropVal(J.NodeProp.IPFS_LINK, dlg.node, ipfsHash);
                            S.props.setNodePropVal(J.NodeProp.BIN_MIME, dlg.node, file.type);
                            S.props.setNodePropVal(J.NodeProp.BIN_SIZE, dlg.node, `${file.size}`);
                            S.props.setNodePropVal(J.NodeProp.BIN_FILENAME, dlg.node, file.name);
                            S.props.setNodePropVal(J.NodeProp.IMG_SIZE, dlg.node, "100%");

                            S.util.ajax<J.SaveNodeRequest, J.SaveNodeResponse>("saveNode", {
                                updateModTime: true,
                                node: dlg.node
                            }, async (res: J.SaveNodeResponse) => {
                                await S.edit.updateIpfsNodeJson(dlg.node, dlg.appState);
                                //S.log("node after IPFS hash added: "+S.util.prettyPrint(dlg.node));
                                S.edit.saveNodeResponse(dlg.node, res, true, dlg.appState);
                            });
                        }
                    }
                });

                this.on("queuecomplete", function (arg) {
                    if (dlg.sent) {
                        if (dlg.numFiles > 1 && !dlg.uploadFailed) {
                            S.util.showMessage("The " + dlg.fileList.length + " uploads were added as sub-nodes of the current node. Open this node to view them.", "Note");
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
            if (file.name && S.util.endsWith(file.name.toLowerCase(), ".zip")) {
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
}
