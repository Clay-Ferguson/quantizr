import { ReactNode } from "react";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "./base/Comp";

let S : Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class Para extends Comp {

    constructor(public content: string = null, attribs : Object = {}) {
        super(attribs);
    }

    compRender(): ReactNode {
        return this.e("p", this.attribs, this.content || "");
    }
}
