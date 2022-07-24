import { ReactNode } from "react";
import { Comp } from "../base/Comp";

export class Img extends Comp {

    // todo-0: is key ever used still?
    constructor(private key: string, attribs : Object = {}) {
        super(attribs);
    }

    compRender = (): ReactNode => {
        return this.tag("img");
    }
}
