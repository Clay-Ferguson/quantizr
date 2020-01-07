import { Comp } from "./base/Comp";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants } from "../Constants";

let S : Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class Img extends Comp {

    constructor(attribs : Object = {}) {
        super(attribs);
    }

    compRender = (p: any) => {
        return S.e("img", p);
    }
}
