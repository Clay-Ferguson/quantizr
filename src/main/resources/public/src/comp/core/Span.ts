import { ReactNode } from "react";
import { Comp } from "../base/Comp";

interface LS { // Local State
    content?: string;
}

export class Span extends Comp {

    constructor(public content: string = "", attribs: any = {}, children: Comp[] = null, private rawHtml: boolean = false) {
        super(attribs);
        this.setChildren(children);
        this.mergeState<LS>({ content });
    }

    override compRender = (): ReactNode => {
        if (this.rawHtml) {
            this.attribs.dangerouslySetInnerHTML = Comp.getDangerousHtml(this.content);
            return this.tag("span");
        }
        else {
            return this.tag("span", null, this.getChildrenWithFirst(this.content));
        }
    }
}
