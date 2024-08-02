import { Comp } from "../base/Comp";

export class Italic extends Comp {

    constructor(attribs: any = null) {
        super(attribs);
        this.tag = "i";
    }
}
