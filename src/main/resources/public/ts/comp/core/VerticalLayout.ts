import { Comp } from "../base/Comp";
import { Div } from "./Div";

export class VerticalLayout extends Div {

    constructor(initialComps: Comp[] = null, justify: string = "left-justified") {
        super();
        this.attribs.className = "vertical " + justify + " layout vertical-layout-row";

        // Wrap all the children provided in Divs, and then make those be the children
        let divWrapComps: Comp[] = [];
        initialComps.forEach(function (child: Comp) {
            if (child) {
                divWrapComps.push(new Div(null, null, [child]));
            }
        });

        this.setChildren(divWrapComps);
    }
}
