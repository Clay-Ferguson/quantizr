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

export class VerticalLayout extends Comp {

    constructor(initialComps: Comp[] = null, justify: string = "left-justified") {
        super(null);
        this.attribs.className = "vertical " + justify + " layout vertical-layout-row";

        // Wrap all the children provided in Divs, and then make those be the children
        let divWrapComps: Comp[] = [];
        initialComps.forEach((child: Comp) => {
            if (child) {
                divWrapComps.push(new Div(null, null, [child]));
            }
        });

        this.setChildren(divWrapComps);
    }

    compRender = () : ReactNode => {
        return this.tagRender('div', null, this.attribs);
    }
}
