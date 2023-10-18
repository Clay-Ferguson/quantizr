import { Comp } from "../base/Comp";

export class Tag extends Comp {

    constructor(public tagName: string, attribs: any = {}, children: Comp[] = null, private textChild: string = null) {
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
