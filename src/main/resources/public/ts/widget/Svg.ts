import { ReactNode } from "react";
import { BaseCompState } from "./base/BaseCompState";
import { Comp } from "./base/Comp";
import { CompIntf } from "./base/CompIntf";

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class Svg<S extends BaseCompState = any> extends Comp<S> {

    constructor(content: string = "", attribs: Object = {}, public initialChildren: CompIntf[] = null) {
        super(attribs);
        this.setChildren(this.initialChildren);
        this.mergeState({ content } as any);
    }

    compRender(): ReactNode {
        return this.tagRender("svg", (this.getState() as any).content, this.attribs);
    }
}
