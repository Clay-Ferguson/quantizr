import { PropTableCell } from "./PropTableCell";
import { Comp } from "./base/Comp";

export class FilesTableRow extends Comp {

    constructor(attribs: any = {}, children: PropTableCell[] = null) {
        super(attribs);
        this.children = children;
        this.tag = "tr";
    }
}
