import { Comp } from "../base/Comp";

export class Ul extends Comp {

    constructor(content: string = "", attribs: any = null, children: Comp[] = null) {
        super(attribs);
        this.children = children;
        this.tag = "ul";
        this.content = content;
    }
}
