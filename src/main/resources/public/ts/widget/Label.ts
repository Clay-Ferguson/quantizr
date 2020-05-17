import { Comp } from "./base/Comp";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C} from "../Constants";
import { ReactNode } from "react";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class Label extends Comp {

    constructor(public content: string = "", attribs: Object = {}) {
        super(attribs);
    }

    compRender(): ReactNode {
        this.state.content = this.content;
        return this.tagRender('label', this.state.content, this.attribs);
    }
}
