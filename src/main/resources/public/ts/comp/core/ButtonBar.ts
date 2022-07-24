import { ReactNode } from "react";
import { Comp } from "../base/Comp";
import { Div } from "./Div";

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

    compRender = (): ReactNode => {
        if (!this.hasChildren()) return null;

        // we have this clone becasue we want our 'ref' to point to the correct top level element 
        // todo-1: would be cleaner if we do this wrapperClass logic externally and not inside this comp!
        let attribsClone = { ...this.attribs };
        delete attribsClone.ref;

        if (this.wrapperClass) {
            return this.tag("div", {
                className: this.wrapperClass,
                key: this.getId("w_"),
                ref: this.attribs.ref
            },
                [new Div(null, attribsClone, this.getChildren())]);
        }
        else {
            return this.tag("div");
        }
    }
}
