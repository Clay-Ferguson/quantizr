console.log("DomBind.ts");

import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants } from "./Constants";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
    s.domBind.init();
});

export class EncryptionOptions {
    // Indicates the node is encrypted in such a way that only it's owner can ever read it
    encryptForOwnerOnly: boolean;
}