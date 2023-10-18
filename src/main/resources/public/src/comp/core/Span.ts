import { Attribs, Comp } from "../base/Comp";

interface LS { // Local State
    content?: string;
}

export class Span extends Comp {
    constructor(content: string = "", attribs: Attribs = {}, children: Comp[] = null) {
        super(attribs);
        this.mergeState<LS>({ content });
        this.setTag("span");
        this.setChildren(children);
    }

    override preRender = (): boolean => {
        this.setContent(this.getState<LS>().content);
        return true;
    }
}
