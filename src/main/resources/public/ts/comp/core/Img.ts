import { ReactNode } from "react";
import { Comp } from "../base/Comp";

export class Img extends Comp {
    constructor(private key: string, attribs : Object = {}) {
        super(attribs);
    }

    compRender = (): ReactNode => {
        return this.tag("img");
    }
}
