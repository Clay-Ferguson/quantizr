import { ReactNode } from "react";
import { Comp } from "./base/Comp";

export class PropTable extends Comp {

    constructor(attribs : Object = {}) {
        super(attribs);
        //(<any>this.attribs).style = "display:table; width:100%;";
        //(<any>this.attribs).sourceClass = "EditPropsTable";
    }

    compRender(): ReactNode {
        return this.tagRender("table", null, this.attribs);
    }
}
