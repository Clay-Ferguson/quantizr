import { Comp } from "../base/Comp";

export class Icon extends Comp {

    constructor(attribs: any = null, private label: string = null) {
        super(attribs);
        this.attribs.className += " appIcon";
        this.tag = "i";
    }

    override preRender(): boolean | null {
        this.children = [this.label];
        return true;
    }
}
