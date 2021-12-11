import { ReactNode } from "react";
import { Comp } from "../base/Comp";

export class AudioPlayer extends Comp {
    compRender(): ReactNode {
        return this.e("audio", this.attribs);
    }
}
