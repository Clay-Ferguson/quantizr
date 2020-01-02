import { Comp } from "./base/Comp";
import { Singletons } from "../Singletons";
import { Constants } from "../Constants";
import { PubSub } from "../PubSub";

let S : Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

//references (these are the audio references, need to lookup video):
//http://www.w3schools.com/tags/ref_av_dom.asp
//https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API 
export class VideoPlayer extends Comp {

    constructor(public attribs: Object) {
        super(attribs);
    }

    getVideoElement(): HTMLVideoElement {
        return <HTMLVideoElement>this.getElement();
    }

    render = (p) => {
        //this method not yet converted to react
        console.error("Feature not currently available.");
        //return S.tag.video(this.attribs, this.render_Children());
        return null;
    }
}
