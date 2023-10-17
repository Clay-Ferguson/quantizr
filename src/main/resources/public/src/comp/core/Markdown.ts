import { Comp } from "../base/Comp";
import ReactMarkdownComp from "./ReactMarkdownComp";

interface LS { // Local State
    content?: string;
}

export class Markdown extends Comp {
    constructor(public content: string = "", public attr: any = null) {
        super(attr);
        this.mergeState<LS>({ content });
        this.setTag(ReactMarkdownComp);
    }

    override preRender = (): boolean => {
        this.setChildren([this.getState<LS>().content]);
        return true;
    }
}
