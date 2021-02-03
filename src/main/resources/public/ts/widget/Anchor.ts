import { ReactNode } from "react";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "./base/Comp";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class Anchor extends Comp {

    /* Either 'content' or 'children' should be passed in. We currently don't handle both at same time */
    constructor(public url: string, public content: string, _attribs: Object = null, children: Comp[] = null, downloadLink: boolean = false) {
        super({ href: url });
        this.setChildren(children);
        if (_attribs) {
            Object.assign(this.attribs, _attribs);
        }
    }

    compRender(): ReactNode {
        return this.e("a", this.attribs, this.buildChildren() || this.content || this.url);
    }
}
