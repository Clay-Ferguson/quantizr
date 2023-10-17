import { ReactNode } from "react";
import { Comp } from "./base/Comp";
import { Tag } from "./core/Tag";

export class Table extends Comp {
    constructor(attribs: any = {}, rows: Comp[] = null) {
        super(attribs);
        this.setChildren(rows);
    }

    override compRender = (): ReactNode => {
        return this.tag("table", null, [
            // special case where tbody always needs to be immediate child of table
            // https://github.com/facebook/react/issues/5652
            new Tag("tbody", { key: this.attribs.key + "_tbody" }, this.getChildren())
        ]);
    }
}
