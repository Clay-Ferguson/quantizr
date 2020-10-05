import { ReactNode } from "react";
import { Comp } from "./base/Comp";

export class Label extends Comp {

    constructor(content: string = "", attribs: Object = {}) {
        super(attribs);
        this.setText(content);
    }

    setText = (content: string) => {
        this.mergeState({ content });
    }

    compRender(): ReactNode {
        return this.tagRender("label", this.getState().content, this.attribs);
    }
}
