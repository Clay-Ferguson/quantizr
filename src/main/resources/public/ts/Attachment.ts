import { ConfirmDlg } from "./dlg/ConfirmDlg";
import { UploadFromFileDropzoneDlg } from "./dlg/UploadFromFileDropzoneDlg";
import { UploadFromUrlDlg } from "./dlg/UploadFromUrlDlg";
import * as I from "./Interfaces";
import { AttachmentIntf } from "./intf/AttachmentIntf";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants } from "./Constants";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class Attachment implements AttachmentIntf {

    /* Node being uploaded to */
    uploadNode: any = null;

    openUploadFromFileDlg = (): void => {
        let node: I.NodeInfo = S.meta64.getHighlightedNode();
        if (!node) {
            this.uploadNode = null;
            S.util.showMessage("No node is selected.");
            return;
        }

        this.uploadNode = node;

        let dlg = new UploadFromFileDropzoneDlg();
        dlg.open();

        /* Note: To run legacy uploader just put this version of the dialog here, and
        nothing else is required. Server side processing is still in place for it
        (new UploadFromFileDlg()).open();
        */
    }

    openUploadFromUrlDlg = (): void => {
        let node: I.NodeInfo = S.meta64.getHighlightedNode();

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
        let node: I.NodeInfo = S.meta64.getHighlightedNode();

        if (node) {
            let dlg = new ConfirmDlg("Delete the Attachment on the Node?", "Confirm Delete Attachment", //
                () => {
                    S.util.ajax<I.DeleteAttachmentRequest, I.DeleteAttachmentResponse>("deleteAttachment", {
                        "nodeId": node.id
                    }, (res: I.DeleteAttachmentResponse): void => { this.deleteAttachmentResponse(res, node.uid) });
                }
            );
            dlg.open();
        }
    }

    deleteAttachmentResponse = (res: I.DeleteAttachmentResponse, uid: string): void => {
        if (S.util.checkSuccess("Delete attachment", res)) {
            S.meta64.removeBinaryByUid(uid);
            // force re-render from local data.
            S.meta64.goToMainPage(true, true);
        }
    }
}