import { ReactNode } from "react";
import { Comp } from "./base/Comp";
import { CompIntf } from "./base/CompIntf";

export class Main extends Comp {

    constructor(attribs: Object = {}, children: CompIntf[] = null) {
        super(attribs);
        this.setChildren(children);
    }

    compRender(): ReactNode {
        return this.tagRender("main", null, this.attribs);
    }
}
