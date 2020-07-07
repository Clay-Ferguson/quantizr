import * as J from "../JavaIntf";
import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { TypeBase } from "./base/TypeBase";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* Type for 'untyped' types. That is, if the user has not set a type explicitly this type will be the default */
export class MarkdownTypeHandler extends TypeBase {
    constructor() {
        //we don't assign an icon to markdown types because that clutters the page. Most everything is markdown.
        super(J.NodeType.NONE, "Markdown", null, /* "fa-align-left" */ true);
    }
}
