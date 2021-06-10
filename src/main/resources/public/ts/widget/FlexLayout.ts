import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "./base/Comp";
import { Div } from "./Div";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class FlexLayout extends Div {

    constructor(initialComps: Comp[] = null, moreClasses: string = "", attribs: any = null) {
        super(null, attribs);
        this.attribs.className = "horizontalLayout " + moreClasses;
        this.setChildren(initialComps);
    }
}
