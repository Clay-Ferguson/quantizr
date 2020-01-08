import { Comp } from "./base/Comp";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants } from "../Constants";
import { ReactNode } from "react";

let S : Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class Para extends Comp {

    constructor(public content: string = "", attribs : Object = {}) {
        super(attribs);
    }

    compRender = (): ReactNode => {
        return S.e('p', this.attribs, (this.content || ""));
    }
}
