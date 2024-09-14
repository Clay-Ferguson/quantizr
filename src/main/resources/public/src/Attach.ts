import { UploadFromFileDropzoneDlg } from "./dlg/UploadFromFileDropzoneDlg";
import { UploadFromUrlDlg } from "./dlg/UploadFromUrlDlg";
import { Attachment, NodeInfo } from "./JavaIntf";
import { S } from "./Singletons";

export class Attach {
    openUploadFromFileDlg = (nodeId: string, autoAddFile: File) => {
        if (!nodeId) {
            const node = S.nodeUtil.getHighlightedNode();
            nodeId = node?.id;
        }

        if (!nodeId) {
            S.util.showMessage("No node is selected.", "Warning");
            return;
        }

        new UploadFromFileDropzoneDlg(nodeId, "", autoAddFile, false, true, () => {
            S.view.jumpToId(nodeId);
        }, true).open();
    };

    openUploadFromUrlDlg = (nodeId: string, onUploadFunc: () => void) => {
        if (!nodeId) {
            const node = S.nodeUtil.getHighlightedNode();
            if (!node) {
                S.util.showMessage("No node is selected.", "Warning");
                return;
            }
            nodeId = node.id;
        }

        new UploadFromUrlDlg(nodeId, onUploadFunc).open();
    };

    getAttachmentUrl = (urlPart: string, node: NodeInfo, attName: string, downloadLink: boolean): string => {
        /* If this node attachment points to external URL return that url */
        const att = S.props.getAttachment(attName, node);
        if (!att) return null;
        return this.getAttUrl(urlPart, att, node.id, downloadLink, attName);
    }

    getAttUrl = (urlPart: string, att: Attachment, nodeId: string, downloadLink: boolean, attName: string): string => {
        if (att.url) {
            return att.url;
        }

        const bin = att.bin;
        if (bin) {
            let ret: string = S.rpcUtil.getRpcPath() + urlPart + "/" + bin + "?nodeId=" + nodeId + "&att=" + attName;

            if (downloadLink) {
                ret += "&download=true";
            }
            return ret;
        }

        return null;
    }

    getUrlForNodeAttachment = (node: NodeInfo, attName: string, downloadLink: boolean): string => {
        return this.getAttachmentUrl("bin", node, attName, downloadLink);
    }

    getStreamUrlForNodeAttachment = (node: NodeInfo, attName: string): string => {
        return this.getAttachmentUrl("stream", node, attName, false);
    }
}
