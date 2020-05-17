import { Comp } from "./base/Comp";
import { Constants as C} from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { ReactNode } from "react";

let S : Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class EditPropsTable extends Comp {

    constructor(attribs : Object = {}) {
        super(attribs);
    }

    compRender(): ReactNode {
        return this.tagRender('div', null, this.attribs);
    }
}
