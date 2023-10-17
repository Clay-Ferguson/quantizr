import { PropTableCell } from "./PropTableCell";
import { Comp } from "./base/Comp";

export class FilesTableRow extends Comp {

    constructor(attribs: any = {}, children: PropTableCell[] = null) {
        super(attribs);
        this.setChildren(children);
        this.setTag("tr");
    }
}
