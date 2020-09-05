import { Comp } from "./base/Comp";
import { Div } from "./Div";

export class LayoutRow extends Div {

    constructor(initialComps: Comp[] = null, moreClasses: string = "", attribs: any = null) {
        super(null, attribs);
        this.attribs.className = "row " + moreClasses; 
        this.setChildren(initialComps);
    }
}
