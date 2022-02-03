import { ReactNode } from "react";
import { Comp } from "../base/Comp";

export class Icon extends Comp {

    constructor(attribs: Object = null) {
        super(attribs);
    }

    compRender(): ReactNode {
        return this.e("i", this.attribs);
    }
}
