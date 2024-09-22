import { Comp } from "../base/Comp";

export class Anchor extends Comp {
    constructor(url: string, content: string, attribs: object = null, children: Comp[] = null) {
        super({ href: url, ...attribs });
        if (children) {
            this.children = [content || url, ...children];
        }
        else {
            this.children = [content || url];
        }
        this.tag = "a";
    }
}
