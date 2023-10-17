import { ReactNode } from "react";
import { Comp } from "../base/Comp";
import { CompIntf } from "../base/CompIntf";

interface LS { // Local State
    content?: string;
}

export class Div extends Comp {
    constructor(public content: string = "", attribs: any = {}, children: CompIntf[] = null) {
        super(attribs);
        this.setChildren(children);
        this.mergeState<LS>({ content });
    }

    override compRender = (): ReactNode => {
        return this.tag("div", null, this.getChildrenWithFirst(this.getState<LS>().content));
    }
}
