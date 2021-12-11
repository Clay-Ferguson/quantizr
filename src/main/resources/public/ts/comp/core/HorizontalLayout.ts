import { ReactNode } from "react";
import { Comp } from "../base/Comp";
import { Div } from "./Div";

/* WARNING: This class doesn't expect 'this.children' to be directly added to, but always only the
'this.comps' should be considered the children to be modified if they need to be modified after the
constructor is called. This is because we dynamically render a table layout here and build the table
children dynamically at render time */
export class HorizontalLayout extends Div {

    constructor(public comps: Comp[] = null, classes: string = "displayTable", attribs: any = {}) {
        super(null, attribs || {});
        this.attribs.className = classes;
    }

    compRender(): ReactNode {
        if (this.comps) {
            for (let comp of this.comps) {
                if (!comp) continue;
                if (!comp.attribs) {
                    comp.attribs = {};
                }

                if (!comp.attribs.className) {
                    comp.attribs.className = "displayCell";
                }
                else {
                    if (comp.attribs.className.indexOf("displayCell") === -1) {
                        comp.attribs.className += " displayCell";
                    }
                }
            }
        }

        this.setChildren([new Div(null, { className: "displayRow" }, this.comps)]);
        return super.compRender();
    }
}
