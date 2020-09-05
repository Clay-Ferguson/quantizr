import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "./base/Comp";
import { Div } from "./Div";

let S : Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class FormGroup extends Div {

    constructor(attribs: Object = null, public initialChildren: Comp[] = null) {
        super(null, attribs);
        this.attribs.className = "form-group";
        this.setChildren(this.initialChildren);
    }
}
