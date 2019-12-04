console.log("EditPropsTable.ts");

import { Comp } from "./base/Comp";
import { Constants } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";

let S : Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class EditPropsTable extends Comp {

    constructor(attribs : Object = {}) {
        super(attribs);
    }

    render = (p) => {
        return this.tagRender('div', null, p);
    }
}
