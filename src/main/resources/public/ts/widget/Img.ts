import { Comp } from "./base/Comp";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants } from "../Constants";
import { ReactNode } from "react";

let S : Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class Img extends Comp {

    constructor(attribs : Object = {}) {
        super(attribs);
    }

    compRender = (p: any): ReactNode => {
        return S.e("img", p);
    }
}
