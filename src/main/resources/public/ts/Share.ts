import * as I from "./Interfaces";
import * as J from "./JavaIntf";
import { SharingDlg } from "./dlg/SharingDlg";
import { ShareIntf } from "./intf/ShareIntf";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants as C} from "./Constants";

let S : Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class Share implements ShareIntf {

    private findSharedNodesResponse = (res: J.GetSharedNodesResponse) => {
        S.srch.searchNodesResponse(res);
    }

    sharingNode: J.NodeInfo = null;

    /*
     * Handles 'Sharing' button on a specific node, from button bar above node display in edit mode
     */
    editNodeSharing = (): void => {
        let node: J.NodeInfo = S.meta64.getHighlightedNode();

        if (!node) {
            S.util.showMessage("No node is selected.");
            return;
        }
        this.sharingNode = node;

        new SharingDlg().open();
    }

    findSharedNodes = (): void => {
        let focusNode: J.NodeInfo = S.meta64.getHighlightedNode();
        if (focusNode == null) {
            return;
        }

        S.util.ajax<J.GetSharedNodesRequest, J.GetSharedNodesResponse>("getSharedNodes", {
            "nodeId": focusNode.id
        }, this.findSharedNodesResponse);
    }
}
