import { Comp, CompT } from "./base/Comp";

export class PropTableCell extends Comp {

    constructor(attribs: any = {}, children: CompT[] = null) {
        super(attribs);
        this.children = children;
        this.tag = "td";
    }
}
