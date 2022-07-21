import { createElement, ReactNode } from "react";
import { Comp } from "./base/Comp";

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class ButtonTag extends Comp {

    constructor(public content: string = "", attribs: Object = {}, initialChildren: Comp[] = null) {
        super(attribs);
    }

    /* Div element is a special case where it renders just its children if there are any, and if not it renders 'content' */
    compRender(): ReactNode {
        return createElement("button", this.attribs, createElement("span", {
            key: "s_" + this.getId()
        }));
    }
}
