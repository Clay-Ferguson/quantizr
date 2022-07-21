import { createElement, ReactNode } from "react";
import { Comp } from "../base/Comp";

export class AudioPlayer extends Comp {
    compRender(): ReactNode {
        return createElement("audio", this.attribs);
    }
}
