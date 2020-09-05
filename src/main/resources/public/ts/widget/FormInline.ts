import { Comp } from "./base/Comp";
import { Div } from "./Div";

// let S : Singletons;
// PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
//     S = ctx;
// });

export class FormInline extends Div {

    constructor(attribs: Object = null, initialChildren: Comp[] = null) {
        super(null, attribs);
        this.attribs.className = "form-inline";
        this.setChildren(initialChildren);
    }
}
