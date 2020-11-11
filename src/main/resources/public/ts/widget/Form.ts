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

export class Form extends Comp {

    constructor(attribs: Object, private initialChildren: CompIntf[] = null) {
        super(attribs);
    }

    compRender(): ReactNode {
        this.setChildren(this.initialChildren);
        return this.e("div", this.attribs, this.buildChildren());
    }
}
