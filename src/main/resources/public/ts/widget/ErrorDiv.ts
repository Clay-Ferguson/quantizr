import { ReactNode } from "react";
import { State } from "../State";
import { BaseCompState } from "./base/BaseCompState";
import { Comp } from "./base/Comp";
import { CompIntf } from "./base/CompIntf";

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class ErrorDiv<S extends BaseCompState = any> extends Comp<S> {

    constructor(s: State<any>) {
        super(null, s);
        this.attribs.className = "validationError";
    }

    compRender(): ReactNode {
        return this.tagRender("div", (this.getState() as any).error, this.attribs);
    }
}
