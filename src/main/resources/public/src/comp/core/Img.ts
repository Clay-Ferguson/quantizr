import { Comp } from "../base/Comp";

export class Img extends Comp {

    constructor(attribs: any = {}) {
        super(attribs);
        this.setTag("img");
    }
}
