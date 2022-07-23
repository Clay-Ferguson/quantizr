import { ReactNode } from "react";
import { Comp } from "./base/Comp";
import { PropTableCell } from "./PropTableCell";

export class FilesTableRow extends Comp {

    constructor(attribs: Object = {}, initialChildren: PropTableCell[] = null) {
        super(attribs);
        this.setChildren(initialChildren);
    }

    compRender = (): ReactNode => {
        return this.tagRender("tr", null, this.attribs);
    }
}
