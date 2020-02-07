import { Comp } from "./base/Comp";
import { Constants as C} from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { ReactNode } from "react";

let S : Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class FormInline extends Comp {

    constructor(attribs: Object = null, initialChildren: Comp[] = null) {
        super(attribs);
        this.attribs.className = "form-inline";
        this.setChildren(initialChildren);
    }

    compRender = (): ReactNode => {
        return this.tagRender('div', null, this.attribs);
    }
}
