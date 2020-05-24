import { Comp } from "./base/Comp";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C} from "../Constants";
import { ReactNode } from "react";

let S : Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class Anchor extends Comp {

    /* Either 'content' or 'children' shuold be passed in. We currently don't handle both at same time */
    constructor(public url: string, public content: string, _attribs: Object = null, children: Comp[] = null) {
        super({ href: url });
        this.children = children;
        S.util.mergeProps(this.attribs, _attribs);
    }

    compRender(): ReactNode {
        return S.e("a", this.attribs, this.buildChildren() || this.content || this.url);
    }
}
