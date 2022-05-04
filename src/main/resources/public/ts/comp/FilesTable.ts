import { ReactNode } from "react";
import { Comp } from "./base/Comp";

export class FilesTable extends Comp {

    constructor(attribs : Object = {}) {
        super(attribs);
    }

    compRender(): ReactNode {
        return this.tagRender("table", null, this.attribs);
    }
}
