import { Comp } from "./base/Comp";
import { Singletons } from "../Singletons";
import { Constants as C} from "../Constants";
import { PubSub } from "../PubSub";
import { ReactNode } from "react";

let S : Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

//references:
//http://www.w3schools.com/tags/ref_av_dom.asp
//https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
export class AudioPlayer extends Comp {

    constructor(attribs: Object) {
        super(attribs);
    }

    getAudioElement(): HTMLAudioElement {
        return <HTMLAudioElement>this.getElement();
    }
    
    compRender(): ReactNode {
        let elm = S.e("audio", this.attribs);
        return elm;
    }
}
