import { ReactNode } from "react";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "./base/Comp";

let S : Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class VideoPlayer extends Comp {

    getVideoElement(): HTMLVideoElement {
        return <HTMLVideoElement> this.getElement();
    }

    compRender(): ReactNode {
        return this.e("video", this.attribs);
    }
}
