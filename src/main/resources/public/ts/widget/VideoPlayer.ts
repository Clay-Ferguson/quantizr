import { ReactNode } from "react";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "./base/Comp";

let S : Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

// references (these are the audio references, need to lookup video):
// http://www.w3schools.com/tags/ref_av_dom.asp
// https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
export class VideoPlayer extends Comp {

    getVideoElement(): HTMLVideoElement {
        return <HTMLVideoElement> this.getElement();
    }

    compRender(): ReactNode {
        let elm = S.e("video", this.attribs);
        return elm;
    }
}
