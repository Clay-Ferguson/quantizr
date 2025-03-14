import { Comp } from "../base/Comp";

export class Li extends Comp {

    constructor(content: string = "", attribs: any = null, children: Comp[] = null) {
        super(attribs);
        if (children) {
            this.children = [content, ...children];
        }
        else {
            this.children = [content];
        }
        this.tag = "li";
    }
}
