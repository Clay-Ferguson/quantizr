import { ReactNode } from "react";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "./base/Comp";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class VideoPlayer extends Comp {

    constructor(attrib: any) {
        super(attrib);
        // console.log("Created VideoPlayer Comp: ID=" + this.getId());
    }

    getVideoElement(): HTMLVideoElement {
        return <HTMLVideoElement>this.getRef();
    }

    compRender(): ReactNode {
        return this.e("video", this.attribs);
    }
}
