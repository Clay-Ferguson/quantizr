import { Comp } from "../base/Comp";
import { Div } from "./Div";

export class LayoutRow extends Div {

    constructor(children: Comp[] = null, moreClasses: string = "", attribs: any = null) {
        super(null, attribs);
        this.attribs.className = "row " + moreClasses;
        this.setChildren(children);
    }
}
