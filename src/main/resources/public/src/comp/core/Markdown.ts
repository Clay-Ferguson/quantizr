import { createElement, ReactNode } from "react";
import { Comp, CompT } from "../base/Comp";
import ReactMarkdownComp from "./ReactMarkdownComp";

export class Markdown extends Comp {
    constructor(private cont: string = "", public attr: any = null) {
        super(attr);
        this.tag = "div"; //<-- not used
    }

    override compRender(_children: CompT[]): ReactNode {
        // ReactMarkdown can't have this 'ref' and would throw a warning if we did
        delete this.attribs.ref;

        return createElement(ReactMarkdownComp as any, this.attribs, this.cont);
    }
}
