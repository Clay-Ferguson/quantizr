import { ReactNode } from "react";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "./base/Comp";
import { CompIntf } from "./base/CompIntf";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class Main extends Comp {

    constructor(attribs: Object = {}, children: CompIntf[] = null) {
        super(attribs);
        this.setChildren(children);
    }

    compRender(): ReactNode {
        return this.tagRender("main", null, this.attribs);
    }
}
