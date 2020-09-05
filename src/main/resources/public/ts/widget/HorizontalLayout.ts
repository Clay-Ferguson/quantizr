import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "./base/Comp";
import { Div } from "./Div";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* todo-1: somehow this is not even doing anything. It's just all vertical divs and I never noticed it was broken
becasue the limited places using it all happen to use span or other things creating the appearance it's working */
export class HorizontalLayout extends Div {

    constructor(initialComps: Comp[] = null, moreClasses: string="", attribs: any=null) {
        super(null, attribs);
        this.attribs.className = "horizontalLayout "+moreClasses; 
        this.setChildren(initialComps);
    }
}
