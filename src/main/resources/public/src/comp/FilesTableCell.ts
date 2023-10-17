import { Comp } from "./base/Comp";

export class FilesTableCell extends Comp {

    constructor(public content: string = null, attribs: any = {}, children: Comp[] = null) {
        super(attribs);
        this.setChildren(children);
        this.setTag("td");
    }

    override preRender = (): boolean => {
        this.setChildren(this.childrenWithFirst(this.content));
        return true;
    }
}
