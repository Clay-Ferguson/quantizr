import { ReactNode } from "react";
import { Comp } from "../base/Comp";

interface LS { // Local State
    content?: string;
}

export class Div extends Comp {
    constructor(public content: string = "", attribs: any = {}) {
        super(attribs);
        this.mergeState<LS>({ content });
    }

    override compRender = (): ReactNode => {
        return this.tag("div", null, this.childrenWithFirst(this.getState<LS>().content));
    }
}
