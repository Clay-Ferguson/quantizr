import * as J from "./JavaIntf";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants as C} from "./Constants";
import { ActivityPubIntf } from "./intf/ActivityPubIntf";
import { AppState } from "./AppState";

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