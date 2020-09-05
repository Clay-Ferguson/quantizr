import { ReactNode } from "react";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "./base/Comp";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class ButtonTag extends Comp {

    constructor(public content: string = "", attribs: Object = {}, initialChildren: Comp[] = null) {
        super(attribs);
    }

    /* Div element is a special case where it renders just its children if there are any, and if not it renders 'content' */
    compRender(): ReactNode {
        return S.e("button", this.attribs, S.e("span", {
            key: "s_" + this.getId(),
            className: "navbar-toggler-icon"
        }));
    }
}
