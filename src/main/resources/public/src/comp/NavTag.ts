import { Comp } from "./base/Comp";

export class NavTag extends Comp {

    constructor(public content: string = "", attribs: any = {}, children: Comp[] = null) {
        super(attribs);
        this.setChildren(children);
        this.setTag("nav");
    }

    override preRender = (): boolean => {
        this.setChildren(this.childrenWithFirst(this.content));
        return true;
    }
}
