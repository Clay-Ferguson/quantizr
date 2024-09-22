import { Attribs, CompT, Comp } from "../base/Comp";

export class Span extends Comp {
    constructor(content: string = null, attribs: Attribs = null, children: CompT[] = null) {
        super(attribs);
        // NOTE: This class is identical to Div, except for this line that sets 'tag' 
        this.tag = "span";

        if (children && children.length > 0) {
            if (content) {
                this.children = [content, ...children];
            }
            else {
                this.children = children;
            }
        }
        else {
            if (content) {
                this.children = [content];
            }
        }
    }
}
