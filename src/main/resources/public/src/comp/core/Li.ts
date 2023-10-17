import { Comp } from "../base/Comp";

export class Li extends Comp {

    constructor(public content: string = "", attribs: any = {}, children: Comp[] = null) {
        super(attribs);
        this.setChildren(children);
        this.setTag("li");
    }

    override preRender = (): boolean => {
        this.setChildren(this.childrenWithFirst(this.content));
        return true;
    }
}
