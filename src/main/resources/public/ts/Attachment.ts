import { AppState } from "./AppState";
import { Constants as C } from "./Constants";
import { ConfirmDlg } from "./dlg/ConfirmDlg";
import { UploadFromFileDropzoneDlg } from "./dlg/UploadFromFileDropzoneDlg";
import { UploadFromIPFSDlg } from "./dlg/UploadFromIPFSDlg";
import { UploadFromTorrentDlg } from "./dlg/UploadFromTorrentDlg";
import { UploadFromUrlDlg } from "./dlg/UploadFromUrlDlg";
import * as J from "./JavaIntf";
import { PubSub } from "./PubSub";
import { Singletons } from "./Singletons";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class Attachment {

    openUploadFromFileDlg = (toIpfs: boolean, node: J.NodeInfo, autoAddFile: File, state: AppState): void => {
        if (node == null) {
            node = S.quanta.getHighlightedNode(state);
        }
        if (!node) {
            S.util.showMessage("No node is selected.", "Warning");
            return;
        }

        const dlg = new UploadFromFileDropzoneDlg(node.id, "", toIpfs, autoAddFile, false, true, state, () => {
            S.view.jumpToId(node.id);
            // S.quanta.refresh(state);
        });
        dlg.open();

        /* Note: To run legacy uploader just put this version of the dialog here, and
        nothing else is required. Server side processing is still in place for it
        (new UploadFromFileDlg()).open();
        */
    };

    openUploadFromUrlDlg = (nodeId: string, defaultUrl: string, onUploadFunc: Function, state: AppState): void => {
        if (!nodeId) {
            let node = S.quanta.getHighlightedNode(state);
            if (!node) {
                S.util.showMessage("No node is selected.", "Warning");
                return;
            }
            nodeId = node.id;
        }

        const dlg = new UploadFromUrlDlg(nodeId, defaultUrl, onUploadFunc, state);
        dlg.open();
    };

    openUploadFromTorrentDlg = (nodeId: string, defaultUrl: string, onUploadFunc: Function, state: AppState): void => {
        if (!nodeId) {
            let node = S.quanta.getHighlightedNode(state);
            if (!node) {
                S.util.showMessage("No node is selected.", "Warning");
                return;
            }
            nodeId = node.id;
        }

        const dlg = new UploadFromTorrentDlg(nodeId, defaultUrl, onUploadFunc, state);
        dlg.open();
    };

    openUploadFromIPFSDlg = (nodeId: string, defaultCid: string, onUploadFunc: Function, state: AppState): void => {
        if (!nodeId) {
            let node = S.quanta.getHighlightedNode(state);
            if (!node) {
                S.util.showMessage("No node is selected.", "Warning");
                return;
            }
            nodeId = node.id;
        }

        const dlg = new UploadFromIPFSDlg(nodeId, defaultCid, onUploadFunc, state);
        dlg.open();
    };

    deleteAttachment = async (node: J.NodeInfo, state: AppState): Promise<boolean> => {
        node = node || S.quanta.getHighlightedNode(state);

        if (node) {
            let dlg: ConfirmDlg = new ConfirmDlg("Delete the Attachment on the Node?", "Confirm", null, null, state);
            await dlg.open();
            if (dlg.yes) {
                await S.util.ajax<J.DeleteAttachmentRequest, J.DeleteAttachmentResponse>("deleteAttachment", {
                    nodeId: node.id
                });
            }
            return dlg.yes;
        }
        return false;
    };

    removeBinaryProperties = (node: J.NodeInfo) => {
        if (node) {
            S.props.allBinaryProps.forEach(s => {
                S.props.deleteProp(node, s);
            });
        }
    };
}
