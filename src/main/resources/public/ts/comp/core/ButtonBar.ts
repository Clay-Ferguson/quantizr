import { ReactNode } from "react";
import { Comp } from "../base/Comp";

export class ButtonBar extends Comp {

    // wrapperClass can be 'text-center' for centering.
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
                className: /* "wrapper " + */ this.wrapperClass,
                key: this.getId() + "_wrp"
            },
                this.e("div", this.attribs, this.buildChildren()));
        }
        else {
            return this.e("div", this.attribs, this.buildChildren());
        }
    }
}
