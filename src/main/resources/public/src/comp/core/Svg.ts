import { Comp } from "../base/Comp";

export class Svg extends Comp {

    constructor(attribs: any = null, children: Comp[] = null) {
        super(attribs);
        this.children = children;
        this.tag = "svg";
    }
}
