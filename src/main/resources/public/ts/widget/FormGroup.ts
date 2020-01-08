import { Comp } from "./base/Comp";
import { Constants } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { ReactNode } from "react";

let S : Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class FormGroup extends Comp {

    constructor(attribs: Object = null, initialChildren: Comp[] = null) {
        super(attribs);
        this.attribs.className = "form-group";
        this.setChildren(initialChildren);
    }

    compRender = (p: any): ReactNode => {
        return this.tagRender('div', null, p);
    }
}
