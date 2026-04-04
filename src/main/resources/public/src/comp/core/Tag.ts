import { Comp, CompT } from "../base/Comp";

export class Tag extends Comp {
    constructor(public tagName: string, attribs: any = null, children: CompT[] = null) {
        super(attribs);
        this.children = children;
        this.tag = tagName;
    }
}
