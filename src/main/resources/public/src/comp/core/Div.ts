import { Comp } from "../base/Comp";

interface LS { // Local State
    content?: string;
}

export class Div extends Comp {
    constructor(public content: string = null, attribs: any = {}, children: any[] = null) {
        super(attribs);
        this.mergeState<LS>({ content });
        this.setChildren(children);
    }

    override preRender = (): boolean => {
        this.setContent(this.getState<LS>().content);
        return true;
    }
}
