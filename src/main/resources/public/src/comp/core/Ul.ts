import { ReactNode } from "react";
import { Comp } from "../base/Comp";
import { CompIntf } from "../base/CompIntf";

export class Ul extends Comp {

    constructor(public content: string = "", attribs: any = {}, children: CompIntf[] = null) {
        super(attribs);
        this.setChildren(children);
    }

    override compRender = (): ReactNode => {
        return this.tag("ul", null, this.childrenWithFirst(this.content));
    }
}
