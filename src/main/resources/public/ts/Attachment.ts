import { ConfirmDlg } from "./dlg/ConfirmDlg";
import { UploadFromFileDropzoneDlg } from "./dlg/UploadFromFileDropzoneDlg";
import { UploadFromUrlDlg } from "./dlg/UploadFromUrlDlg";
import * as J from "./JavaIntf";
import { AttachmentIntf } from "./intf/AttachmentIntf";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants as C } from "./Constants";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class Attachment implements AttachmentIntf {

    /* Node being uploaded to */
    uploadNode: any = null;

    openUploadFromFileDlg = (toIpfs: boolean): void => {
        let node: J.NodeInfo = S.meta64.getHighlightedNode();
        if (!node) {
            this.uploadNode = null;
            S.util.showMessage("No node is selected.");
            return;
        }

        this.uploadNode = node;

        let dlg = new UploadFromFileDropzoneDlg(toIpfs);
        dlg.open();

        /* Note: To run legacy uploader just put this version of the dialog here, and
        nothing else is required. Server side processing is still in place for it
        (new UploadFromFileDlg()).open();
        */
    }

    openUploadFromUrlDlg = (): void => {
        let node: J.NodeInfo = S.meta64.getHighlightedNode();

        if (!node) {
            this.uploadNode = null;
            S.util.showMessage("No node is selected.");
            return;
        }

        this.uploadNode = node;

        let dlg = new UploadFromUrlDlg();
        dlg.open();
    }

    deleteAttachment = (): void => {
        let node: J.NodeInfo = S.meta64.getHighlightedNode();

        if (node) {
            let dlg = new ConfirmDlg("Delete the Attachment on the Node?", "Confirm Delete Attachment", //
                () => {
                    S.util.ajax<J.DeleteAttachmentRequest, J.DeleteAttachmentResponse>("deleteAttachment", {
                        "nodeId": node.id
                    }, (res: J.DeleteAttachmentResponse): void => { this.deleteAttachmentResponse(res, node.id) });
                }
            );
            dlg.open();
        }
    }

    deleteAttachmentResponse = (res: J.DeleteAttachmentResponse, id: string): void => {
        if (S.util.checkSuccess("Delete attachment", res)) {
            S.meta64.removeBinaryById(id);
            // force re-render from local data.
            S.meta64.refresh();
        }
    }
}