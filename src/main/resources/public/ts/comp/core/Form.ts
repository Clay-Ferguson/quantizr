import { ReactNode } from "react";
import { Comp } from "../base/Comp";
import { CompIntf } from "../base/CompIntf";

// todo-0: Form can be replaced by Div, and in many cases simply removed if there's no need for a wrapper.
export class Form extends Comp {

    constructor(attribs: Object, private initialChildren: CompIntf[] = null) {
        super(attribs);
    }

    compRender = (): ReactNode => {
        this.setChildren(this.initialChildren);
        return this.tag("div");
    }
}
