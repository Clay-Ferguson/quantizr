import { ReactNode } from "react";
import { Comp } from "../base/Comp";

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class Para extends Comp {

    constructor(public content: string = null, attribs: Object = {}) {
        super(attribs);
    }

    compRender = (): ReactNode => {
        return this.tag("p", null, [this.content]);
    }
}
