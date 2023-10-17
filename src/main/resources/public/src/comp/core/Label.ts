import { ReactNode } from "react";
import { Comp } from "../base/Comp";

export class Label extends Comp {

    constructor(private content: string = "", attribs: any = {}) {
        super(attribs);
    }

    override compRender = (): ReactNode => {
        return this.tag("label", null, this.childrenWithFirst(this.content));
    }
}
