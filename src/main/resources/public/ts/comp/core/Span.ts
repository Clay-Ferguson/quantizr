import { createElement, ReactNode } from "react";
import { Comp } from "../base/Comp";

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class Span<LocalState = any> extends Comp {
    rawHtml: boolean = false;

    constructor(public content: string = "", attribs: Object = {}, initialChildren: Comp[] = null) {
        super(attribs);
        this.setChildren(initialChildren);
    }

    compRender = (): ReactNode => {
        if (this.rawHtml) {
            let _p: any = { id: this.getId(), key: this.getId() };
            _p.dangerouslySetInnerHTML = { __html: this.content };
            return createElement("span", { ...this.attribs, ..._p });
        }
        else {
            return this.tagRender("span", this.content, this.attribs);
        }
    }
}
