import { ReactNode } from "react";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "./base/Comp";

let S : Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

//references:
//http://www.w3schools.com/tags/ref_av_dom.asp
//https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
//https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement
//Creates an HTMLAudioElement
export class AudioPlayer extends Comp {

    constructor(attribs: Object) {
        super(attribs);
    }
    
    compRender(): ReactNode {
        return S.e("audio", this.attribs);
    }
}
