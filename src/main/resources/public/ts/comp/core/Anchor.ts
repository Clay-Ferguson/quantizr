import { createElement, ReactNode } from "react";
import { Comp } from "../base/Comp";

export class Anchor extends Comp {

    /* Either 'content' or 'children' should be passed in. We currently don't handle both at same time */
    constructor(public url: string, public content: string, attribs: Object = null, children: Comp[] = null, downloadLink: boolean = false) {
        super({ href: url, ...attribs });
        this.setChildren(children);
    }

    compRender = (): ReactNode => {
        if (this.attribs.dangerouslySetInnerHTML) {
            return createElement("a", this.attribs);
        }
        else {
            return createElement("a", this.attribs, this.buildChildren() || this.content || this.url);
        }
    }
}
