import { Comp } from "../base/Comp";

interface LS { // Local State
    content: string;
}

export class Svg extends Comp {

    constructor(content: string = "", attribs: any = null, children: Comp[] = null) {
        super(attribs);
        this.children = children;
        this.mergeState<LS>({ content });
        this.tag = "svg";
    }

    override preRender = (): boolean => {
        this.content = this.getState<LS>().content;
        return true;
    }
}
