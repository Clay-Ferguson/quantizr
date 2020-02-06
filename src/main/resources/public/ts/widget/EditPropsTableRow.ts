import { Comp } from "./base/Comp";
import * as I from "../Interfaces";
import * as J from "../JavaIntf";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants } from "../Constants";
import { ReactNode } from "react";

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
    compRender = (): ReactNode => {
        return this.tagRender('div', null, this.attribs);
    }
}
