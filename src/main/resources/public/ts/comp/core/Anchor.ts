import { ReactNode } from "react";
import { Comp } from "../base/Comp";

export class Anchor extends Comp {

    /* Either 'content' or 'children' should be passed in. We currently don't handle both at same time */
    constructor(public url: string, public content: string, attribs: Object = null, children: Comp[] = null, downloadLink: boolean = false) {
        super({ href: url, ...attribs });
        this.setChildren(children);
    }

    compRender = (): ReactNode => {
        return this.tag("a", null, this.getChildrenWithFirst(this.content || this.url));
    }
}
