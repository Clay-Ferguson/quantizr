import { ReactNode } from "react";
import { Comp } from "../base/Comp";

export class Heading extends Comp {

    constructor(public level: number, public content: string, attrs: Object = {}) {
        super(attrs);
    }

    compRender = (): ReactNode => {
        return this.tag("h" + this.level, this.attribs, [this.content]);
    }
}
