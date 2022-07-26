import { ReactNode } from "react";
import { Comp } from "../base/Comp";

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class Pre extends Comp {

    constructor(public content: string = "", attribs: Object = {}) {
        super(attribs);
        this.attribs.dangerouslySetInnerHTML = Comp.getDangerousHtml(this.content);
    }

    compRender = (): ReactNode => {
        return this.tag("pre");
    }
}
