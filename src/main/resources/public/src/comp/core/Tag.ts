import { Comp } from "../base/Comp";

export class Tag extends Comp {

    constructor(public tagName: string, attribs: any = null, children: Comp[] = null, private textChild: string = null) {
        super(attribs);
        this.children = children;
        this.tag = tagName;
    }

    override preRender(): boolean | null {
        if (this.textChild) {
            this.children = [this.textChild];
        }
        return true;
    }
}
