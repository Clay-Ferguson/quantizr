import { ReactNode } from "react";
import { Comp } from "./base/Comp";

export class Spinner extends Comp {

    constructor() {
        super({
            className: "spinner-border text-success",
            role: "status"
        });
    }

    compRender(): ReactNode {
        return this.e("div", this.attribs);
    }
}
