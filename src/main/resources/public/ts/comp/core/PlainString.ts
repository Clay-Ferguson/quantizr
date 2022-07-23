import { ReactNode } from "react";
import { Comp } from "../base/Comp";

export class PlainString extends Comp {

    constructor(private content: string) {
        super();
    }

    compRender = (): ReactNode => {
        return this.content;
    }
}
