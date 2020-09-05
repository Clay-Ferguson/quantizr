import { ReactNode } from "react";
import { Comp } from "./base/Comp";
import { PropTableCell } from "./PropTableCell";

export class PropTableRow extends Comp {

    constructor(attribs: Object = {}, initialChildren: PropTableCell[] = null) {
        super(attribs);
        //(<any>this.attribs).style = "display: table-row;";
        //(<any>this.attribs).sourceClass = "EditPropsTableRow";
        this.setChildren(initialChildren);
    }

    compRender(): ReactNode {
        return this.tagRender("tr", null, this.attribs);
    }
}
