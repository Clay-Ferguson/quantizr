import { ReactNode } from "react";
import { Comp } from "./base/Comp";

export class PropTable extends Comp {

    constructor(attribs : Object = {}) {
        super(attribs);
    }

    compRender = (): ReactNode => {
        return this.tag("table", null, this.attribs);
    }
}
