import { ReactNode } from "react";
import { Comp } from "./base/Comp";
import { CompIntf } from "./base/CompIntf";

interface LocalState {
    content: string;
}

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class Svg<StateType> extends Comp<LocalState> {

    constructor(content: string = "", attribs: Object = {}, public initialChildren: CompIntf[] = null) {
        super(attribs);
        this.setChildren(this.initialChildren);
        this.mergeState({ content });
    }

    compRender(): ReactNode {
        return this.tagRender("svg", this.getState().content, this.attribs);
    }
}
