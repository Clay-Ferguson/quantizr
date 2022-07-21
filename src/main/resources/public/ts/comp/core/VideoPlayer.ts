import { createElement, ReactNode } from "react";
import { Comp } from "../base/Comp";

export class VideoPlayer extends Comp {

    constructor(attrib: any) {
        super(attrib);
        // console.log("Created VideoPlayer Comp: ID=" + this.getId());
    }

    getVideoElement(): HTMLVideoElement {
        return <HTMLVideoElement>this.getRef();
    }

    compRender(): ReactNode {
        return createElement("video", this.attribs);
    }
}
