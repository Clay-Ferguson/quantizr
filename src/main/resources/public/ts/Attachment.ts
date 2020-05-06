import { ConfirmDlg } from "./dlg/ConfirmDlg";
import { UploadFromFileDropzoneDlg } from "./dlg/UploadFromFileDropzoneDlg";
import { UploadFromUrlDlg } from "./dlg/UploadFromUrlDlg";
import * as J from "./JavaIntf";
import { AttachmentIntf } from "./intf/AttachmentIntf";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants as C } from "./Constants";
import { AppState } from "./AppState";

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

        let dlg = new UploadFromFileDropzoneDlg(node, toIpfs, autoAddFile, false, state);
        dlg.open();

        /* Note: To run legacy uploader just put this version of the dialog here, and
        nothing else is required. Server side processing is still in place for it
        (new UploadFromFileDlg()).open();
        */
    }

    openUploadFromUrlDlg = (node: J.NodeInfo, defaultUrl: string, state: AppState): void => {
        if (!node) {
            node = S.meta64.getHighlightedNode(state);
        }

        if (!node) {
            S.util.showMessage("No node is selected.", "Warning");
            return;
        }

        let dlg = new UploadFromUrlDlg(node, defaultUrl, state);
        dlg.open();
    }

    deleteAttachment = (state: AppState): void => {
        let node: J.NodeInfo = S.meta64.getHighlightedNode(state);

        if (node) {
            let dlg = new ConfirmDlg("Delete the Attachment on the Node?", "Confirm Delete Attachment", //
                () => {
                    S.util.ajax<J.DeleteAttachmentRequest, J.DeleteAttachmentResponse>("deleteAttachment", {
                        "nodeId": node.id
                    }, (res: J.DeleteAttachmentResponse): void => { this.deleteAttachmentResponse(res, node.id, state) });
                }, null, null, null, state
            );
            dlg.open();
        }
    }

    deleteAttachmentResponse = (res: J.DeleteAttachmentResponse, id: string, state: AppState): void => {
        if (S.util.checkSuccess("Delete attachment", res)) {
            S.meta64.removeBinaryById(id, state);
            S.meta64.refresh(state);
        }
    }
}