import { Comp } from "../base/Comp";

export class FlexLayout extends Comp {

    constructor(children: Comp[] = null, moreClasses: string = "", attribs: any = null) {
        super(attribs);
        this.attribs.className = "horizontalLayout " + moreClasses;
        this.children = children;
    }
}
