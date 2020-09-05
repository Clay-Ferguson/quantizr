import { ReactNode } from "react";
import { Comp } from "./base/Comp";

export class PropTableCell extends Comp {

    constructor(public content: string = "", attribs : Object = {}, initialChildren: Comp[] = null) {
        super(attribs);
        this.setChildren(initialChildren);
    }

    compRender(): ReactNode {
        return this.tagRender("td", (this.content || ""), this.attribs);
    }
}
