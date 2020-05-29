import { ServerPushIntf } from "./intf/ServerPushIntf";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants as C} from "./Constants";
import * as J from "./JavaIntf";
import { InboxNotifyDlg } from "./dlg/InboxNotifyDlg";
import { store } from "./AppRedux";

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
            console.log("ServerPush Recieved: " + e.data);
            new InboxNotifyDlg("Your Inbox has updates!", store.getState()).open();
        };

        eventSource.onopen = (e: any) => {
            console.log("ServerPush.onopen" + e);
        }

        eventSource.onerror = (e: any) => {
            console.log("ServerPush.onerror:" + e);
        };

        eventSource.addEventListener('serverPushEvent', function (e: any) {
            // let serverPushInfo: J.ServerPushInfo = JSON.parse(e.data);
            // debugger;
            //console.log("ServerPushEvent:", S.util.prettyPrint(serverPushInfo));
            //NOTE: For now we don't do anything that great or scalable but just let user know their inbox had new goodies in it.
            //new InboxNotifyDlg("Your Inbox has updates!", store.getState()).open();
        }, false);
    }
}

