import { Comp } from "../base/Comp";

export class Li extends Comp {

    constructor(content: string = "", attribs: any = {}, children: Comp[] = null) {
        super(attribs);
        this.setChildren(children);
        this.setTag("li");
        this.setContent(content);
    }
}
