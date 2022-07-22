import { createElement, ReactNode } from "react";
import { Comp } from "../base/Comp";
import { CompIntf } from "../base/CompIntf";

interface LS { // Local State
    content?: string;
}

export class TutorialApp extends Comp {
    constructor() {
        super();
        this.mergeState<LS>({ content: "Quanta GUI Framework works!" });
    }

    compRender(): ReactNode {
        return this.tagRender("div", this.getState<LS>().content, this.attribs);
    }
}
