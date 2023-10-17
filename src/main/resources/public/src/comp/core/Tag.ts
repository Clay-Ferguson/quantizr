import { Comp } from "../base/Comp";
import { CompIntf } from "../base/CompIntf";

export class Tag extends Comp {

    constructor(public tagName: string, attribs: any = {}, children: CompIntf[] = null, private textChild: string = null) {
        super(attribs);
        this.setChildren(children);
        this.setTag(tagName);
    }

    override preRender = (): boolean => {
        if (this.textChild) {
            this.setChildren([this.textChild]);
        }
        return true;
    }
}
