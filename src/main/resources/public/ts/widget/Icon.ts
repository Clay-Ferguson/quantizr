import { ReactNode } from "react";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "./base/Comp";

let S : Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class Icon extends Comp {

    constructor(attribs: Object = null) {
        super(attribs);
    }

    compRender(): ReactNode {
        /* Yes Icon uses "i" tag, this is not a mistake */
        return S.e("i", this.attribs);
    }
}
