import { ReactNode } from "react";
import { Comp } from "../base/Comp";

export class Anchor extends Comp {

    /* Either 'content' or 'children' should be passed in. We currently don't handle both at same time */
    constructor(public url: string, public content: string, _attribs: Object = null, children: Comp[] = null, downloadLink: boolean = false) {
        super({ href: url });
        this.setChildren(children);
        if (_attribs) {
            Object.assign(this.attribs, _attribs);
        }
    }

    compRender(): ReactNode {
        if (this.attribs.dangerouslySetInnerHTML) {
            return this.e("a", this.attribs);
        }
        else {
            return this.e("a", this.attribs, this.buildChildren() || this.content || this.url);
        }
    }
}
