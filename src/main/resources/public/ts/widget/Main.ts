import { ReactNode } from "react";
import { Comp } from "./base/Comp";
import { CompIntf } from "./base/CompIntf";

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class Main<StateType = any> extends Comp<StateType> {

    constructor(content: string = "", attribs: Object = {}, public initialChildren: CompIntf[] = null) {
        super(attribs);
        this.setChildren(this.initialChildren);
        this.mergeState({ content } as any);
    }

    compRender(): ReactNode {
        return this.tagRender("main", (this.getState() as any).content, this.attribs);
    }
}
