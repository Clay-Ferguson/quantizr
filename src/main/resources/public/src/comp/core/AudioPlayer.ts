import { Comp } from "../base/Comp";

export class AudioPlayer extends Comp {
    constructor(attrs: any) {
        super(attrs);
        this.tag = "audio";
    }
}
