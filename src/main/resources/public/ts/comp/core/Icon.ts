import { ReactNode } from "react";
import { Comp } from "../base/Comp";

export class Icon extends Comp {

    constructor(attribs: Object = null, private label: string = null) {
        super(attribs);
    }

    compRender(): ReactNode {
        return this.e("i", this.attribs, this.label);
    }
}
