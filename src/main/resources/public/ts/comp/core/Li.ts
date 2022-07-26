import { ReactNode } from "react";
import { Comp } from "../base/Comp";

export class Li extends Comp {

    constructor(public content: string = "", attribs: Object = {}, public initialChildren: Comp[] = null) {
        super(attribs);
        this.setChildren(this.initialChildren);
    }

    compRender = (): ReactNode => {
        return this.tag("li", null, this.getChildrenWithFirst(this.content));
    }
}
