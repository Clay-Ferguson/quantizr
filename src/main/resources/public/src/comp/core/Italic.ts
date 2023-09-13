import { ReactNode } from "react";
import { Comp } from "../base/Comp";

export class Italic extends Comp {

    constructor(attribs: any = {}) {
        super(attribs);
    }

    override compRender = (): ReactNode => {
        return this.tag("i");
    }
}
