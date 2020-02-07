import { Comp } from "./base/Comp";
import { Constants as C} from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Div } from "./Div";
import { ReactNode } from "react";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class HorizontalLayout extends Comp {

    constructor(initialComps: Comp[] = null, moreClasses: string="") {
        super(null);
        this.attribs.className = "horizontalLayout "+moreClasses; 
        this.setChildren(initialComps);
    }

    compRender = () : ReactNode => {
        return this.tagRender('div', null, this.attribs);
    }
}
