import { Comp } from "../base/Comp";

interface LS { // Local State
    content?: string;
}

export class Div extends Comp {
    constructor(content: string = null, attribs: any = {}, children: any[] = null) {
        super(attribs);
        this.mergeState<LS>({ content });
        this.children = children;
    }

    override preRender = (): boolean => {
        this.content = this.getState<LS>().content;
        return true;
    }
}
