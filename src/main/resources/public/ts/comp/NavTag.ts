import { ReactNode } from "react";
import { Comp } from "./base/Comp";

export class NavTag extends Comp {

    constructor(public content: string = "", attribs: Object = {}, initialChildren: Comp[] = null) {
        super(attribs);
        this.setChildren(initialChildren);
    }

    compRender = (): ReactNode => {
        return this.tag("nav", null, this.getChildrenWithFirst(this.content));
    }
}
