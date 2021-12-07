import { ReactNode } from "react";
import { State } from "../State";
import { Comp } from "./base/Comp";
import { CompIntf } from "./base/CompIntf";

interface LS {
    error: string;
}

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class ErrorDiv<StateType = any> extends Comp<StateType> {

    constructor(s: State<any>) {
        super(null, s);
        this.attribs.className = "validationError";
    }

    compRender(): ReactNode {
        return this.tagRender("div", this.getState<LS>().error, this.attribs);
    }
}
