import * as I from "./Interfaces";
import { SharingDlg } from "./dlg/SharingDlg";
import { ShareIntf } from "./intf/ShareIntf";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants } from "./Constants";

let S : Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class Share implements ShareIntf {

    private findSharedNodesResponse = (res: I.GetSharedNodesResponse) => {
        S.srch.searchNodesResponse(res);
    }

    sharingNode: I.NodeInfo = null;

    /*
     * Handles 'Sharing' button on a specific node, from button bar above node display in edit mode
     */
    editNodeSharing = (): void => {
        let node: I.NodeInfo = S.meta64.getHighlightedNode();

        if (!node) {
            S.util.showMessage("No node is selected.");
            return;
        }
        this.sharingNode = node;

        new SharingDlg().open();
    }

    findSharedNodes = (): void => {
        let focusNode: I.NodeInfo = S.meta64.getHighlightedNode();
        if (focusNode == null) {
            return;
        }

        S.util.ajax<I.GetSharedNodesRequest, I.GetSharedNodesResponse>("getSharedNodes", {
            "nodeId": focusNode.id
        }, this.findSharedNodesResponse);
    }
}
