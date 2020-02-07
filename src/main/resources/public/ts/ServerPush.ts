import { ServerPushIntf } from "./intf/ServerPushIntf";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants as C} from "./Constants";

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

        // taking whole block offline for now. 
        // Serverside is disabled right now on purpose. 
        //define call to server
        // const eventSource = new EventSource(S.util.getRpcPath() + "serverPush");

        // eventSource.onmessage = e => {
        //     //const msg = JSON.parse(e.data);
        //     console.log("ServerPush Recieved: " + e.data);
        // };

        // eventSource.onopen = (e: any) => {
        //     console.log("ServerPush.onopen" + e);
        // }

        // eventSource.onerror = (e: any) => {
        //     console.log("ServerPush.onerror:" + e);
        // };

        // // set handler function for the event type 
        // eventSource.addEventListener('serverPushEvent', function (e: any) {
        //     console.log("ServerPushEvent:", e.data);
        // }, false);
    }
}

