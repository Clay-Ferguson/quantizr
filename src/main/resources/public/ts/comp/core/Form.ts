import { createElement, ReactNode } from "react";
import { Comp } from "../base/Comp";
import { CompIntf } from "../base/CompIntf";

export class Form extends Comp {

    constructor(attribs: Object, private initialChildren: CompIntf[] = null) {
        super(attribs);
    }

    compRender(): ReactNode {
        this.setChildren(this.initialChildren);
        return createElement("div", this.attribs, this.buildChildren());
    }
}
