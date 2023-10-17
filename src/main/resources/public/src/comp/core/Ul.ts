import { Comp } from "../base/Comp";
import { CompIntf } from "../base/CompIntf";

export class Ul extends Comp {

    constructor(public content: string = "", attribs: any = {}, children: CompIntf[] = null) {
        super(attribs);
        this.setChildren(children);
        this.setTag("ul");
    }

    override preRender = (): boolean => {
        this.setChildren(this.childrenWithFirst(this.content));
        return true;
    }
}
