import { Comp } from "../base/Comp";
import { Div } from "./Div";

export class ButtonBar extends Comp {

    // wrapperClass can be 'tw-text-center' for centering.
    /* WARNING: There's a flawed edge case where if you have only ONE button, and it happens to be
     'tw-float-right' then the button bar ends up taking up ZERO height, and breaks the layout. The
     solution is to add a "new Clearfix()" after the ButtonBar (below the ButtonBar) */
    constructor(buttons: Comp[] = null, private wrapperClass: string = null, private extraClass: string = null) {
        super(null);
        this.children = buttons;
    }

    override preRender(): boolean | null {
        const props = {
            className: "inline-flex btnGroup flex-wrap " + (this.extraClass ? this.extraClass : ""),
            role: "group"
        };

        if (this.wrapperClass) {
            const children = this.children;
            this.children = [new Div(null, props, children)];
            this.attribs.className = this.wrapperClass;
        }
        else {
            this.attribs.className = props.className;
            this.attribs.role = props.role;
        }
        return true;
    }
}
