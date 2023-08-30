import { ReactNode, createElement } from "react";
import { Comp } from "../base/Comp";
import ReactMarkdownComp from "./ReactMarkdownComp";

interface LS { // Local State
    content?: string;
}

export class Markdown extends Comp {
    constructor(public content: string = "", public attr: any = null) {
        super(attr);
        this.mergeState<LS>({ content });
    }

    override compRender = (): ReactNode => {
        const state = this.getState<LS>();
        delete this.attribs.ref;
        return createElement(ReactMarkdownComp as any, this.attribs, state.content);
    }
}
