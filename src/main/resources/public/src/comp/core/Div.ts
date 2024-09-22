import { Comp, CompT } from "../base/Comp";

interface LS { // Local State
    content?: string;
}

export class Div extends Comp {
    constructor(content: string = null, attribs: any = {}, children: CompT[] = null) {
        super(attribs);
        this.mergeState<LS>({ content });
        this.children = children;
    }

    override preRender(): CompT[] | boolean | null{
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
