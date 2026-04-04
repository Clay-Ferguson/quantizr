import { Comp } from "../base/Comp";

export class Label extends Comp {

    constructor(content: string = "", attribs: any = null) {
        super(attribs);
        this.children = [content];
        this.tag = "label";
    }
}
