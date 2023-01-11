import { getAs } from "./AppContext";
import { UploadFromFileDropzoneDlg } from "./dlg/UploadFromFileDropzoneDlg";
import { UploadFromIPFSDlg } from "./dlg/UploadFromIPFSDlg";
import { UploadFromUrlDlg } from "./dlg/UploadFromUrlDlg";
import * as J from "./JavaIntf";
import { S } from "./Singletons";

export class Attachment {
    openUploadFromFileDlg = (toIpfs: boolean, nodeId: string, autoAddFile: File) => {
        if (!nodeId) {
            const node = S.nodeUtil.getHighlightedNode(getAs());
            nodeId = node?.id;
        }

        if (!nodeId) {
            S.util.showMessage("No node is selected.", "Warning");
            return;
        }

        new UploadFromFileDropzoneDlg(nodeId, "", toIpfs, autoAddFile, false, true, () => {
            S.view.jumpToId(nodeId);
        }).open();
    };

    openUploadFromUrlDlg = (nodeId: string, defaultUrl: string, onUploadFunc: Function) => {
        if (!nodeId) {
            const node = S.nodeUtil.getHighlightedNode(getAs());
            if (!node) {
                S.util.showMessage("No node is selected.", "Warning");
                return;
            }
            nodeId = node.id;
        }

        new UploadFromUrlDlg(nodeId, onUploadFunc).open();
    };

    openUploadFromIPFSDlg = (nodeId: string, defaultCid: string, onUploadFunc: Function) => {
        if (!nodeId) {
            const node = S.nodeUtil.getHighlightedNode();
            if (!node) {
                S.util.showMessage("No node is selected.", "Warning");
                return;
            }
            nodeId = node.id;
        }

        new UploadFromIPFSDlg(nodeId, onUploadFunc).open();
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
        return this.getAttachmentUrl("bin", node, attName, downloadLink);
    }

    getStreamUrlForNodeAttachment = (node: J.NodeInfo, attName: string): string => {
        return this.getAttachmentUrl("stream", node, attName, false);
    }
}
