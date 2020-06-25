import { Comp } from "./base/Comp";
import { Constants as C} from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Div } from "./Div";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class LayoutRow extends Div {

    constructor(initialComps: Comp[] = null, moreClasses: string="", attribs: any=null) {
        super(null, attribs);
        this.attribs.className = "row "+moreClasses; 
        this.setChildren(initialComps);
    }
}
