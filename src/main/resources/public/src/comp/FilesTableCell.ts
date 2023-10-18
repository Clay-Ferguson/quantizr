import { Comp } from "./base/Comp";

export class FilesTableCell extends Comp {

    constructor(content: string = null, attribs: any = {}, children: Comp[] = null) {
        super(attribs);
        this.setChildren(children);
        this.setTag("td");
        this.setContent(content);
    }
}
