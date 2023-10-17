import { Comp } from "../base/Comp";

export class Italic extends Comp {

    constructor(attribs: any = {}) {
        super(attribs);
        this.setTag("i");
    }
}
