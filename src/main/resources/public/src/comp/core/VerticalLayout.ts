import { Comp } from "../base/Comp";
import { Div } from "./Div";

export class VerticalLayout extends Comp {

    constructor(children: Comp[] = null, justify: string = "left-justified") {
        super();
        this.attribs.className = justify + " vertLayoutRow";

        if (children) {
            children = children.map(child => {
                return child ? new Div(null, null, [child]) : null;
            }).filter(c => !!c);

            this.children = children;
        }
    }
}
