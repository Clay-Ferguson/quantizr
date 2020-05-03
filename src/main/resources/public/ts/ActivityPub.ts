import * as J from "./JavaIntf";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants as C} from "./Constants";
import { ActivityPubIntf } from "./intf/ActivityPubIntf";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});
export class ActivityPub implements ActivityPubIntf {

    postNode = (): void => {
        let node: J.NodeInfo = S.meta64.getHighlightedNode();
        if (node) {
            S.util.ajax<J.ActivityPubPostRequest, J.ActivityPubPostResponse>("activityPubPost", {
                "nodeId": node.id,
            }, this.activityPubPostResponse);
        }
    }

    private activityPubPostResponse = (res: J.ActivityPubPostResponse): void => {
        //console.log("ExecuteNodeResponse running.");

        // S.util.checkSuccess("Execute Node", res);
        // S.util.showMessage(res.output, true, "modal-lg");
        // S.view.refreshTree(null, false, null, false, false, null);
        // S.meta64.selectTab("mainTab");
        // S.view.scrollToSelectedNode(null);
    }
}