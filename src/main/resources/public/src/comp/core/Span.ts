import { Attribs, CompT, Comp } from "../base/Comp";

interface LS { // Local State
    content?: string;
}

export class Span extends Comp {

    constructor(content: string = "", attribs: Attribs = null, children: CompT[] = null) {
        super(attribs);
        this.mergeState<LS>({ content });
        this.tag = "span";
        this.children = children;
    }

  override preRender(): CompT[] | boolean | null {
        const content = this.getState<LS>().content;
        if (content) {
            if (this.children) {
                return [content, ...this.children];
            }
            else {
                return [content];
            }
        }
        return this.children;
    }
}
