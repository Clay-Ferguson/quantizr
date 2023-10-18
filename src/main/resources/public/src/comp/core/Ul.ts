import { Comp } from "../base/Comp";
import { CompIntf } from "../base/CompIntf";

export class Ul extends Comp {

    constructor(content: string = "", attribs: any = {}, children: CompIntf[] = null) {
        super(attribs);
        this.setChildren(children);
        this.setTag("ul");
        this.setContent(content);
    }
}
