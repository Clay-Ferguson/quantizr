import { Attribs, Comp } from "../base/Comp";

interface LS { // Local State
    content?: string;
}

export class Span extends Comp {
    constructor(content: string = "", attribs: Attribs = null, children: Comp[] = null) {
        super(attribs);
        this.mergeState<LS>({ content });
        this.tag = "span";
        this.children = children;
    }

    override preRender(): boolean | null {
        this.content = this.getState<LS>().content;
        return true;
    }
}
