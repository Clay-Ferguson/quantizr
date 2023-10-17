import { Comp } from "../base/Comp";

export class Anchor extends Comp {
    constructor(public url: string, public content: string, attribs: object = null, children: Comp[] = null) {
        super({ href: url, ...attribs });
        this.setChildren(children);
        this.setTag("a");
    }

    override preRender = (): boolean => {
        this.setChildren(this.childrenWithFirst(this.content || this.url));
        return true;
    }
}
