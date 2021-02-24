import { AxiosPromise } from "axios";
import { fastDispatch } from "./AppRedux";
import { AppState } from "./AppState";
import { Constants as C } from "./Constants";
import { ConfirmDlg } from "./dlg/ConfirmDlg";
import { UploadFromFileDropzoneDlg } from "./dlg/UploadFromFileDropzoneDlg";
import { UploadFromUrlDlg } from "./dlg/UploadFromUrlDlg";
import { UploadFromIPFSDlg } from "./dlg/UploadFromIPFSDlg";
import { AttachmentIntf } from "./intf/AttachmentIntf";
import * as J from "./JavaIntf";
import { PubSub } from "./PubSub";
import { Singletons } from "./Singletons";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class Attachment implements AttachmentIntf {

    openUploadFromFileDlg = (toIpfs: boolean, node: J.NodeInfo, autoAddFile: File, state: AppState): void => {
        if (node == null) {
            node = S.meta64.getHighlightedNode(state);
        }
        if (!node) {
            S.util.showMessage("No node is selected.", "Warning");
            return;
        }

        const dlg = new UploadFromFileDropzoneDlg(node.id, "", toIpfs, autoAddFile, false, true, state, () => {
            S.meta64.refresh(state);
        });
        dlg.open();

        /* Note: To run legacy uploader just put this version of the dialog here, and
        nothing else is required. Server side processing is still in place for it
        (new UploadFromFileDlg()).open();
        */
    }

    openUploadFromUrlDlg = (nodeId: string, defaultUrl: string, onUploadFunc: Function, state: AppState): void => {
        if (!nodeId) {
            let node = S.meta64.getHighlightedNode(state);
            if (!node) {
                S.util.showMessage("No node is selected.", "Warning");
                return;
            }
            nodeId = node.id;
        }

        const dlg = new UploadFromUrlDlg(nodeId, defaultUrl, onUploadFunc, state);
        dlg.open();
    }

    openUploadFromIPFSDlg = (nodeId: string, defaultCid: string, onUploadFunc: Function, state: AppState): void => {
        if (!nodeId) {
            let node = S.meta64.getHighlightedNode(state);
            if (!node) {
                S.util.showMessage("No node is selected.", "Warning");
                return;
            }
            nodeId = node.id;
        }

        const dlg = new UploadFromIPFSDlg(nodeId, defaultCid, onUploadFunc, state);
        dlg.open();
    }

    deleteAttachment = (node: J.NodeInfo, state: AppState): Promise<boolean> => {
        return new Promise<boolean>(async (resolve, reject) => {
            let deleted = false;
            try {
                node = node || S.meta64.getHighlightedNode(state);
                let delPromise: AxiosPromise<any> = null;
                if (node) {
                    const dlg = new ConfirmDlg("Delete the Attachment on the Node?", "Confirm", //
                        () => {
                            delPromise = S.util.ajax<J.DeleteAttachmentRequest, J.DeleteAttachmentResponse>("deleteAttachment", {
                                nodeId: node.id
                            }, (res: J.DeleteAttachmentResponse): void => {
                                this.deleteAttachmentResponse(res, node.id, state);
                                deleted = true;
                            });
                        }, null, null, null, state
                    );
                    await dlg.open();
                    if (delPromise) {
                        await delPromise;
                    }
                }
            } finally {
                resolve(deleted);
            }
        });
    }

    deleteAttachmentResponse = (res: J.DeleteAttachmentResponse, id: string, state: AppState): void => {
        if (S.util.checkSuccess("Delete attachment", res)) {
            // but for now just do a dispatch that forces a refresh from client memory (not server)
            fastDispatch({
                type: "Action_FastRefresh",
                updateNew: (s: AppState): AppState => {
                    return { ...state };
                }
            });
        }
    }

    removeBinaryProperties = (node: J.NodeInfo) => {
        if (node) {
            S.props.allBinaryProps.forEach(s => {
                S.props.deleteProp(node, s);
            });
        }
    }
}
