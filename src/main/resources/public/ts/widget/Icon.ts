import { Comp } from "./base/Comp";
import { Constants as C} from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { ReactNode } from "react";

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
