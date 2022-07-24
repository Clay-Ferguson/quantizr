import { ReactNode } from "react";
import { Comp } from "./base/Comp";
import { CompIntf } from "./base/CompIntf";

interface LS { // Local State
    content?: string;
}

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class Main extends Comp {

    constructor(content: string = "", attribs: Object = {}, public initialChildren: CompIntf[] = null) {
        super(attribs);
        this.setChildren(this.initialChildren);
        this.mergeState<LS>({ content });
    }

    compRender = (): ReactNode => {
        return this.tag("main", null, this.getChildrenWithFirst(this.getState<LS>().content));
    }
}
