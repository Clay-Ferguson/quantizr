import { AppState } from "./AppState";
import { Constants as C } from "./Constants";
import { ActivityPubIntf } from "./intf/ActivityPubIntf";
import * as J from "./JavaIntf";
import { PubSub } from "./PubSub";
import { Singletons } from "./Singletons";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});
export class ActivityPub implements ActivityPubIntf {

    postNode = (state: AppState): void => {
        let node: J.NodeInfo = S.meta64.getHighlightedNode(state);
        if (node) {
            S.util.ajax<J.ActivityPubPostRequest, J.ActivityPubPostResponse>("activityPubPost", {
                nodeId: node.id,
            }, this.activityPubPostResponse);
        }
    }

    private activityPubPostResponse = (res: J.ActivityPubPostResponse): void => {
    }
}