import { Comp } from "../base/Comp";

export class Img extends Comp {

    constructor(attribs: any = null) {
        super(attribs);
        this.tag = "img";
    }
}
