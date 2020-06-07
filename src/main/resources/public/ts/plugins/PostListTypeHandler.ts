import * as J from "../JavaIntf";
import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { TypeBase } from "./base/TypeBase";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* Type of node that hosts the user's social media posts, which I think will
also have an option to include (or not) other friends who they are following */
export class PostListTypeHandler extends TypeBase {
    constructor() {
        super(J.NodeType.FRIEND, "Post List", "fa-th-list", true);
    }
}
