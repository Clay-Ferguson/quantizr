import { Constants as C } from "../Constants";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { TypeBase } from "./base/TypeBase";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* Type for 'untyped' types. That is, if the user has not set a type explicitly this type will be the default */
export class TextTypeHandler extends TypeBase {
    constructor() {
        super(J.NodeType.PLAIN_TEXT, "Plain Text", "fa-file-text", true);
    }
}
