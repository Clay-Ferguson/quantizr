import { Comp } from "./base/Comp";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants } from "../Constants";

let S : Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class Anchor extends Comp {

    /* Either 'content' or 'children' shuold be passed in. We currently don't handle both at same time */
    constructor(public url: string, public content: string, _attribs: Object = null, children: Comp[] = null) {
        super({ href: url });
        this.children = children;
        S.util.mergeProps(this.attribs, _attribs);
    }

    render = (p) => {
        this.repairProps(p);
        return S.e('a', p, this.children || this.content || this.url);
    }
}
