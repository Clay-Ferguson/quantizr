import { Comp } from "../base/Comp";

interface LS { // Local State
    content?: string;
}

export class Span extends Comp {
    constructor(public content: string = "", attribs: any = {}) {
        super(attribs);
        this.mergeState<LS>({ content });
        this.setTag("span");
    }

    override preRender = (): boolean => {
        this.setChildren(this.childrenWithFirst(this.content));
        return true;
    }
}
