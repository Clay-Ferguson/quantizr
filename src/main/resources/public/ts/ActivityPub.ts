import * as I from "./Interfaces";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants } from "./Constants";
import { ActivityPubIntf } from "./intf/ActivityPubIntf";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});
export class ActivityPub implements ActivityPubIntf {

    postNode = (): void => {
        let node: I.NodeInfo = S.meta64.getHighlightedNode();
        if (node) {
            S.util.ajax<I.ActivityPubPostRequest, I.ActivityPubPostResponse>("activityPubPost", {
                "nodeId": node.id,
            }, this.activityPubPostResponse);
        }
    }

    private activityPubPostResponse = (res: I.ActivityPubPostResponse): void => {
        //console.log("ExecuteNodeResponse running.");

        // S.util.checkSuccess("Execute Node", res);
        // S.util.showMessage(res.output, true, "modal-lg");
        // S.view.refreshTree(null, false);
        // S.meta64.selectTab("mainTab");
        // S.view.scrollToSelectedNode(null);
    }
}