import { ReactNode } from "react";
import { Comp } from "../base/Comp";
import { CompIntf } from "../base/CompIntf";

export class FlexRowLayout extends Comp {

    constructor(public comps: CompIntf[] = null, moreClasses: string = "", attribs: any = {}) {
        super(attribs);
        this.attribs.className = "flexRowLayout " + moreClasses;
    }

    compRender = (): ReactNode => {
        return this.tag("div", this.attribs, this.comps);
    }
}
