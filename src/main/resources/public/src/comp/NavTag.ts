import { Comp } from "./base/Comp";

export class NavTag extends Comp {

    constructor(content: string = "", attribs: any = {}, children: Comp[] = null) {
        super(attribs);
        this.children = children;
        this.tag = "nav";
        this.content = content;
    }
}
