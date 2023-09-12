import { Comp } from "../base/Comp";
import { Div } from "./Div";

export class FlexLayout extends Div {

    constructor(children: Comp[] = null, moreClasses: string = "", attribs: any = null) {
        super(null, attribs);
        this.attribs.className = "horizontalLayout " + moreClasses;
        this.setChildren(children);
    }
}
