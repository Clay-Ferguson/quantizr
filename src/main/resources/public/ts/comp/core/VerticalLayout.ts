import { Comp } from "../base/Comp";
import { Div } from "./Div";

export class VerticalLayout extends Div {

    constructor(children: Comp[] = null, justify: string = "left-justified") {
        super();
        this.attribs.className = "vertical " + justify + " layout vertical-layout-row";

        if (children) {
            children = children.map(child => {
                return child ? new Div(null, null, [child]) : null;
            }).filter(c => !!c);

            this.setChildren(children);
        }
    }
}
