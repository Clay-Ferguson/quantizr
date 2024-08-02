import { Comp } from "../base/Comp";

export class Anchor extends Comp {
    constructor(url: string, content: string, attribs: object = null, children: Comp[] = null) {
        super({ href: url, ...attribs });
        this.children = children;
        this.tag = "a";
        this.content = content || url;
    }
}
