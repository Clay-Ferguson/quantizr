import { Comp } from "../base/Comp";

export class Ul extends Comp {

    constructor(content: string = "", attribs: any = {}, children: Comp[] = null) {
        super(attribs);
        this.setChildren(children);
        this.setTag("ul");
        this.setContent(content);
    }
}
