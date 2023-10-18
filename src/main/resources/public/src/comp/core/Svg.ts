import { Comp } from "../base/Comp";
import { CompIntf } from "../base/CompIntf";

interface LS { // Local State
    content: string;
}

export class Svg extends Comp {

    constructor(content: string = "", attribs: any = {}, children: CompIntf[] = null) {
        super(attribs);
        this.setChildren(children);
        this.mergeState<LS>({ content });
        this.setTag("svg");
    }

    override preRender = (): boolean => {
        this.setContent(this.getState<LS>().content);
        return true;
    }
}
