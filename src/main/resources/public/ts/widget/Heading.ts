import { ReactNode } from "react";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "./base/Comp";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class Heading extends Comp {

    constructor(public level: number, public content: string, attrs: Object = {}) {
        super(attrs);
    }

    compRender(): ReactNode {
        return S.e("h" + this.level, this.attribs, this.content);
    }
}
