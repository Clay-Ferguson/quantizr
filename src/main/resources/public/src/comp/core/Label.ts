import { Comp } from "../base/Comp";

export class Label extends Comp {

    constructor(private content: string = "", attribs: any = {}) {
        super(attribs);
        this.setTag("label");
    }

    override preRender = (): boolean => {
        this.setChildren(this.childrenWithFirst(this.content));
        return true
    }
}
