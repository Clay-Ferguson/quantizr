import { createElement, ReactNode } from "react";
import { Comp } from "../base/Comp";

export class Img extends Comp {

    constructor(private key: string, attribs : Object = {}) {
        super(attribs);
    }

    compRender = (): ReactNode => {
        // console.log("Render IMG: id="+this.getId());
        // this.attribs.style = this.attribs.style || {};
        // this.attribs.style.maxWidth = "calc(100% - 12px)";
        // this.attribs.style.width = "calc(100% - 12px)";
        return createElement("img", this.attribs);
    }
}
