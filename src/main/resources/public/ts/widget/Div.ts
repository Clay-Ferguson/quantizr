import { ReactNode } from "react";
import { Comp } from "./base/Comp";
import { CompIntf } from "./base/CompIntf";

// So that users of this class don't need a state deriving from one with a 'content' prop
// we use an 'as any' in here. Just a convenient tradeoff.

interface LS {
    content?: string;
}

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class Div extends Comp {
    constructor(public content: string = "", attribs: Object = {}, public initialChildren: CompIntf[] = null) {
        super(attribs);
        this.setChildren(this.initialChildren);
        this.mergeState<LS>({ content });
    }

    compRender(): ReactNode {
        if (this.renderRawHtml) {
            let _p: any = { id: this.getId(), key: this.getId() };
            _p.dangerouslySetInnerHTML = { __html: this.content };
            return this.e("div", { ...this.attribs, ..._p });
        }
        else {
            return this.tagRender("div", this.getState<LS>().content, this.attribs);
        }
    }
}
