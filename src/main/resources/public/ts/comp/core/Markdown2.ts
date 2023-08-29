import { ReactNode, createElement } from "react";
import { Comp } from "../base/Comp";
import ReactMarkdown from "react-markdown";

interface LS { // Local State
    content?: string;
}

/* todo-0: This is the candidate to replace "Markdown" once "react-markdown" is vetted well enough to replace "marked" */
export class Markdown2 extends Comp {
    constructor(public content: string = "") {
        super(null);
        this.mergeState<LS>({ content });
    }

    override compRender = (): ReactNode => {
        const state = this.getState<LS>();
        return createElement(ReactMarkdown as any, null, state.content);
    }
}
