import { Comp } from "./base/Comp";

interface LS { // Local State
    content?: string;
}

export class Main extends Comp {

    constructor(content: string = "", attribs: any = {}, children: Comp[] = null) {
        super(attribs);
        this.children = children;
        this.mergeState<LS>({ content });
        this.tag = "main";
    }

    override preRender(): boolean | null {
        this.content = this.getState<LS>().content;
        return true;
    }
}
