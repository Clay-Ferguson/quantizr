import { ServerPushIntf } from "./intf/ServerPushIntf";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants as C } from "./Constants";
import * as J from "./JavaIntf";
import { InboxNotifyDlg } from "./dlg/InboxNotifyDlg";
import { store, dispatch } from "./AppRedux";
import { AppState } from "./AppState";

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

        eventSource.onmessage = e => {
            debugger;
            //todo-0: detect new feedPush NodeInfo and merge it into local data state of feed list.
            console.log("ServerPush Recieved: " + e.data);

            let dataObj = JSON.parse(e.data);

            if (dataObj.type == "feedPush") {
                let nodeInfo: J.NodeInfo = dataObj.nodeInfo;
                if (nodeInfo) {
                    dispatch({
                        type: "Action_RenderFeedResults",
                        update: (s: AppState): void => {
                            s.feedResults = s.feedResults || [];

                            //this is a slight hack to cause the new rows to animate their background, but it's ok, and I plan to leave it like this
                            (nodeInfo as any).fadeIn = true;
                            s.feedResults.unshift(nodeInfo);
                        }
                    });
                }
                console.log("Feed Push!");
            }

            //todo-0: put this code back, but need to check for the right e.data.tyep do this for the inbox type
            //new InboxNotifyDlg("Your Inbox has updates!", store.getState()).open();
        };

        eventSource.onopen = (e: any) => {
            console.log("ServerPush.onopen" + e);
        }

        eventSource.onerror = (e: any) => {
            console.log("ServerPush.onerror:" + e);
        };

        //todo-0: need to go back to this way of handling events, so we can make type-safety easier
        //and not need a 'type' on the object sent from the client.
        eventSource.addEventListener('serverPushEvent', function (e: any) {
            // let serverPushInfo: J.ServerPushInfo = JSON.parse(e.data);
            //console.log("ServerPushEvent:", S.util.prettyPrint(serverPushInfo));
            //NOTE: For now we don't do anything that great or scalable but just let user know their inbox had new goodies in it.
            //new InboxNotifyDlg("Your Inbox has updates!", store.getState()).open();
        }, false);
    }
}

