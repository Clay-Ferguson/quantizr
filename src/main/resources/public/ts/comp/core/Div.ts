import { createElement, ReactNode } from "react";
import { Comp } from "../base/Comp";
import { CompIntf } from "../base/CompIntf";

interface LS { // Local State
    content?: string;
}

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class Div extends Comp {
    rawHtml: boolean = false;

    constructor(public content: string = "", attribs: Object = {}, public initialChildren: CompIntf[] = null) {
        super(attribs);
        this.setChildren(this.initialChildren);
        this.mergeState<LS>({ content });
    }

    compRender = (): ReactNode => {
        if (this.rawHtml) {
            let _p: any = { id: this.getId(), key: this.getId() };
            _p.dangerouslySetInnerHTML = { __html: this.content };
            return createElement("div", { ...this.attribs, ..._p });
        }
        else {
            return this.tagRender("div", this.getState<LS>().content, this.attribs);
        }
    }
}
