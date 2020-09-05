import { ReactNode } from "react";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "./base/Comp";

let S : Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class PropTable extends Comp {

    constructor(attribs : Object = {}) {
        super(attribs);
        //(<any>this.attribs).style = "display:table; width:100%;";
        //(<any>this.attribs).sourceClass = "EditPropsTable";
    }

    compRender(): ReactNode {
        return this.tagRender("table", null, this.attribs);
    }
}

