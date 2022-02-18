import { ReactNode } from "react";
import { Comp } from "../base/Comp";

export class ButtonBar extends Comp {

    // wrapperClass can be 'text-center' for centering.
    /* WARNING: There's a pathological case where if you have only ONE button, and it happens to be 'float-end' then
     the button bar ends up taking up ZERO height, and breaks the layout. The solution is to add a "new Clearfix()"
     after the ButtonBar (below the ButtonBar) */
    constructor(initialButtons: Comp[] = null, private wrapperClass: string = "", private extraClass: string = "") {
        super(null);
        this.attribs.className = "btn-group btnGroup flex-wrap " + extraClass;
        this.attribs.role = "group";
        this.setChildren(initialButtons);
    }

    compRender(): ReactNode {
        if (!this.hasChildren()) return null;

        if (this.wrapperClass) {
            return this.e("div", {
                className: this.wrapperClass,
                key: this.getId() + "_wrp"
            },
                this.e("div", this.attribs, this.buildChildren()));
        }
        else {
            return this.e("div", this.attribs, this.buildChildren());
        }
    }
}
