import { Comp } from "./base/Comp";
import { Constants } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Div } from "./Div";
import { ReactNode } from "react";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class HorizontalLayout extends Comp {

    constructor(initialComps: Comp[] = null) {
        super(null);
        this.attribs.className = "horizontalLayout"; 
        this.setChildren(initialComps);
    }

    compRender = () : ReactNode => {
        return this.tagRender('div', null, this.attribs);
    }
}
