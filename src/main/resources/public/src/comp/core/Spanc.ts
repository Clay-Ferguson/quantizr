import { ReactNode } from "react";
import { Comp } from "../base/Comp";

export class Spanc extends Comp {
    constructor(attribs: any = {}, children: Comp[] = null) {
        super(attribs);
        this.setChildren(children);
    }

    override compRender = (): ReactNode => {
        return this.tag("span", null, null);
    }
}
