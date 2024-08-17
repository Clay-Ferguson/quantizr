import { Comp } from "./base/Comp";
import { Tag } from "./core/Tag";

export class Table extends Comp {
    constructor(attribs: any = {}, rows: Comp[] = null) {
        super(attribs);
        this.children = rows;
        this.tag = "table";
    }

    override preRender = (): boolean => {
        const children = this.children;
        this.children = [
            // special case where tbody always needs to be immediate child of table
            // https://github.com/facebook/react/issues/5652
            new Tag("tbody", null, children)
        ];
        return true;
    }
}
