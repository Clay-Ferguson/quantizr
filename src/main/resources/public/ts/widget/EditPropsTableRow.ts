console.log("EditPropsTableRow.ts");

import { Comp } from "./base/Comp";
import * as I from "../Interfaces";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants } from "../Constants";

let S : Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class EditPropsTableRow extends Comp {

    propEntry: I.PropEntry;

    constructor(attribs : Object = {}) {
        super(attribs);
    }

    /* Div element is a special case where it renders just its children if there are any, and if not it renders 'content' */
    render = (p): string => {
        return this.tagRender('div', null, p);
    }
}
