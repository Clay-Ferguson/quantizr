import { Comp } from "./base/Comp";
import { Constants } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { ReactNode } from "react";

let S : Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class EditPropsTable extends Comp {

    constructor(attribs : Object = {}) {
        super(attribs);
    }

    compRender = (p: any): ReactNode => {
        return this.tagRender('div', null, p);
    }
}
