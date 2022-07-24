import { ReactNode } from "react";
import { Comp } from "../base/Comp";

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class Ul extends Comp {

    constructor(public content: string = "", attribs: Object = {}, public initialChildren: Comp[] = null) {
        super(attribs);
        this.setChildren(this.initialChildren);
    }

    compRender = (): ReactNode => {
        return this.tag("ul", null, this.getChildrenWithFirst(this.content));
    }
}
