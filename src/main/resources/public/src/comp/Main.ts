import { Comp, CompT } from "./base/Comp";

interface LS { // Local State
    content?: string;
}

export class Main extends Comp {

    constructor(content: string = "", attribs: any = {}) {
        super(attribs);
        this.mergeState<LS>({ content });
        this.tag = "main";
    }

    override preRender(): CompT[] | boolean | null {
        return [this.getState<LS>().content];
    }
}
