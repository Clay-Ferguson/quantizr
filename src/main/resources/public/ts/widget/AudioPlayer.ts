import { Comp } from "./base/Comp";
import { Singletons } from "../Singletons";
import { Constants } from "../Constants";
import { PubSub } from "../PubSub";
import { ReactNode } from "react";

let S : Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

//references:
//http://www.w3schools.com/tags/ref_av_dom.asp
//https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
export class AudioPlayer extends Comp {

    constructor(public attribs: Object) {
        super(attribs);
    }

    getAudioElement(): HTMLAudioElement {
        return <HTMLAudioElement>this.getElement();
    }

    compRender = (p: any): ReactNode => {
        let elm = S.e('audio', p);
        return elm;
    }
}
