import { Comp } from "../base/Comp";

export class VideoPlayer extends Comp {

    constructor(attrib: any) {
        super(attrib);
        this.tag = "video";
    }

    getVideoElement(): HTMLVideoElement {
        return <HTMLVideoElement>this.getRef();
    }
}
