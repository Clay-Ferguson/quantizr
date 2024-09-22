import { Attribs, Comp, CompT } from "../base/Comp";

export class Div extends Comp {
    constructor(content: string = null, attribs: Attribs = null, children: CompT[] = null) {
        super(attribs);

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
