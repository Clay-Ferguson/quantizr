import { getAppState } from "./AppContext";
import { AppState } from "./AppState";
import { ConfirmDlg } from "./dlg/ConfirmDlg";
import { UploadFromFileDropzoneDlg } from "./dlg/UploadFromFileDropzoneDlg";
import { UploadFromIPFSDlg } from "./dlg/UploadFromIPFSDlg";
import { UploadFromUrlDlg } from "./dlg/UploadFromUrlDlg";
import * as J from "./JavaIntf";
import { S } from "./Singletons";

export class Attachment {
    openUploadFromFileDlg = (toIpfs: boolean, node: J.NodeInfo, autoAddFile: File, state: AppState) => {
        state = getAppState(state);
        node = node || S.nodeUtil.getHighlightedNode(state);

        if (!node) {
            S.util.showMessage("No node is selected.", "Warning");
            return;
        }

        new UploadFromFileDropzoneDlg(node.id, "", toIpfs, autoAddFile, false, true, () => {
            S.view.jumpToId(node.id);
        }).open();

        /* Note: To run legacy uploader just put this version of the dialog here, and
        nothing else is required. Server side processing is still in place for it
        (new UploadFromFileDlg()).open();
        */
    };

    openUploadFromUrlDlg = (nodeId: string, defaultUrl: string, onUploadFunc: Function, state: AppState) => {
        if (!nodeId) {
            const node = S.nodeUtil.getHighlightedNode(state);
            if (!node) {
                S.util.showMessage("No node is selected.", "Warning");
                return;
            }
            nodeId = node.id;
        }

        new UploadFromUrlDlg(nodeId, defaultUrl, onUploadFunc).open();
    };

    openUploadFromIPFSDlg = (nodeId: string, defaultCid: string, onUploadFunc: Function, state: AppState) => {
        if (!nodeId) {
            const node = S.nodeUtil.getHighlightedNode(state);
            if (!node) {
                S.util.showMessage("No node is selected.", "Warning");
                return;
            }
            nodeId = node.id;
        }

        new UploadFromIPFSDlg(nodeId, defaultCid, onUploadFunc).open();
    };

    deleteAttachment = async (node: J.NodeInfo, attName: string, state: AppState): Promise<boolean> => {
        node = node || S.nodeUtil.getHighlightedNode(state);
        if (node) {
            const dlg = new ConfirmDlg("Delete the Attachment on the Node?", "Confirm", "btn-danger", "alert alert-danger");
            await dlg.open();
            if (dlg.yes) {
                await S.rpcUtil.rpc<J.DeleteAttachmentRequest, J.DeleteAttachmentResponse>("deleteAttachment", {
                    nodeId: node.id,
                    attName
                });
            }
            return dlg.yes;
        }
        return false;
    };

    getAttachmentUrl = (urlPart: string, node: J.NodeInfo, attName: string, downloadLink: boolean): string => {
        /* If this node attachment points to external URL return that url */
        const att = S.props.getAttachment(attName, node);
        if (!att) return null;

        if (att.u) {
            return att.u;
        }

        const ipfsLink = att.il;
        let bin = att.b;

        if (bin || ipfsLink) {
            if (ipfsLink) {
                bin = "ipfs";
            }
            let ret: string = S.rpcUtil.getRpcPath() + urlPart + "/" + bin + "?nodeId=" + node.id;

            if (downloadLink) {
                ret += "&download=true";
            }
            return ret;
        }

        return null;
    }

    getUrlForNodeAttachment = (node: J.NodeInfo, attName: string, downloadLink: boolean): string => {
        return node.dataUrl ? node.dataUrl : this.getAttachmentUrl("bin", node, attName, downloadLink);
    }

    getStreamUrlForNodeAttachment = (node: J.NodeInfo, attName: string): string => {
        return this.getAttachmentUrl("stream", node, attName, false);
    }
}
