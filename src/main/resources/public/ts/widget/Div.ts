import { ReactNode } from "react";
import { Comp } from "./base/Comp";
import { CompIntf } from "./base/CompIntf";

// So that users of this class don't need a state deriving from one with a 'content' prop
// we use an 'as any' in here. Just a convenient tradeoff.

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class Div<StateType = any> extends Comp<StateType> {
    constructor(public content: string = "", attribs: Object = {}, public initialChildren: CompIntf[] = null) {
        super(attribs);
        this.setChildren(this.initialChildren);
        this.mergeState({ content } as any);
    }

    compRender(): ReactNode {
        if (this.renderRawHtml) {
            let _p: any = { id: this.getId(), key: this.getId() };
            _p.dangerouslySetInnerHTML = { __html: this.content };
            return this.e("div", { ...this.attribs, ..._p });
        }
        else {
            return this.tagRender("div", (this.getState() as any).content, this.attribs);
        }
    }
}
