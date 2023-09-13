import { ReactNode } from "react";
import { Comp } from "../base/Comp";
import { CompIntf } from "../base/CompIntf";

export class Tag extends Comp {

    constructor(public tagName: string, attribs: any = {}, children: CompIntf[] = null, private textChild: string = null) {
        super(attribs);
        this.setChildren(children);
    }

    override compRender = (): ReactNode => {
        return this.textChild ? this.tag(this.tagName, null, [this.textChild]) : this.tag(this.tagName);
    }
}
