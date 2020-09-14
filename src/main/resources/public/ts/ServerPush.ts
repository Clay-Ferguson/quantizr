import { dispatch } from "./AppRedux";
import { AppState } from "./AppState";
import { Constants as C } from "./Constants";
import { ServerPushIntf } from "./intf/ServerPushIntf";
import * as J from "./JavaIntf";
import { PubSub } from "./PubSub";
import { Singletons } from "./Singletons";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

// reference: https://www.baeldung.com/spring-server-sent-events
// See also: AppController.java#serverPush
//
export class ServerPush implements ServerPushIntf {
    init = (): any => {
        console.log("ServerPush.init");

        const eventSource = new EventSource(S.util.getRpcPath() + "serverPush");

        // DO NOT DELETE.
        // eventSource.onmessage = e => {
        // };

        eventSource.onopen = (e: any) => {
            // onsole.log("ServerPush.onopen" + e);
        };

        eventSource.onerror = (e: any) => {
            // console.log("ServerPush.onerror:" + e);
        };

        eventSource.addEventListener("feedPush", function (e: any) {
            const obj = JSON.parse(e.data);
            // console.log("Incomming Push: "+S.util.prettyPrint(obj));
            const nodeInfo: J.NodeInfo = obj.nodeInfo;
            if (nodeInfo) {
                // todo-1: I think this dispatch is working, but another full FeedView refresh (from actual server query too) is somehow following after also
                // so need to check and see how to avoid that.
                dispatch({
                    type: "Action_RenderFeedResults",
                    update: (s: AppState): void => {
                        s.feedResults = s.feedResults || [];

                        /* If we detect the incomming change that is our own creation, we display it, but if it's not our own we
                        don't display because for now we aren't doing live feed updates since that can be a nuisance for users to have the
                        page change while they're maybe reading it */
                        if (nodeInfo.owner === s.userName) {

                            // this is a slight hack to cause the new rows to animate their background, but it's ok, and I plan to leave it like this
                            S.render.fadeInId = nodeInfo.id;
                            s.feedResults.unshift(nodeInfo);

                            // scan for any nodes in feedResults where nodeInfo.parent.id is found in the list nodeInfo.id, and
                            // then remove the nodeInfo.id from the list becasue it would be redundant in the list.
                            // s.feedResults = S.meta64.removeRedundantFeedItems(s.feedResults);
                        }
                        else {
                            /* note: we could que up the incomming nodeInfo, adn then avoid a call to the server but for now we just
                            keep it simple and only set a dirty flag */
                            s.feedDirty = true;
                        }
                    }
                });
            }
        }, false);

        eventSource.addEventListener("inboxPush", function (e: any) {
            // Removing this type notification for now, because it's not really ready. For example, if bob creates a reply to a feed item bob gets
            // the notification, which is wrong. In other words based on the new 'feed' capability notification can
            // end up being just a redundant annoyance.

            // temporary remove: I was seeing this come up when I replied to someone ELSES node, or in other words I was getting
            // a notification about my own node that I creted.
            // todo-0
            // new InboxNotifyDlg("Your Inbox has updates!", store.getState()).open();
        }, false);
    }
}
