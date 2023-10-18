import { Comp } from "../base/Comp";

interface LS { // Local State
    content?: string;
}

export class Div extends Comp {
    constructor(public content: string = "", attribs: any = {}) {
        super(attribs);
        this.mergeState<LS>({ content });
    }

    override preRender = (): boolean => {
        this.setContent(this.getState<LS>().content);
        return true;
    }
}
