import { ReactNode } from "react";
import { Comp } from "./base/Comp";
import { CompIntf } from "./base/CompIntf";

interface LS { // Local State
    content?: string;
}

export class Main extends Comp {

    constructor(content: string = "", attribs: any = {}, children: CompIntf[] = null) {
        super(attribs);
        this.setChildren(children);
        this.mergeState<LS>({ content });
    }

    override compRender = (): ReactNode => {
        return this.tag("main", null, this.childrenWithFirst(this.getState<LS>().content));
    }
}
