import { Comp } from "../base/Comp";

export class Li extends Comp {

    constructor(content: string = "", attribs: any = null, children: Comp[] = null) {
        super(attribs);
        this.children = children;
        this.tag = "li";
        this.content = content;
    }
}
