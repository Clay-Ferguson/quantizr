import { ReactNode } from "react";
import { Comp } from "../base/Comp";

interface LS { // Local State
    content: string;
}

export class Label extends Comp {
    constructor(private content: string = "", attribs: Object = {}) {
        super(attribs);
    }

    compRender = (): ReactNode => {
        return this.tag("label", null, this.getChildrenWithFirst(this.content));
    }
}
