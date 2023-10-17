import { ReactNode } from "react";
import { Comp } from "../base/Comp";

interface LS { // Local State
    content?: string;
}

export class SpanHtml extends Comp {
    constructor(public content: string = "", attribs: any = null) {
        super(attribs);
        this.mergeState<LS>({ content });
    }

    override compRender = (): ReactNode => {
        this.attribs.dangerouslySetInnerHTML = Comp.getDangerousHtml(this.content);
        return this.tag("span");
    }
}
