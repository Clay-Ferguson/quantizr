import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Div } from "./Div";

let S : Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class Header extends Div {

    constructor(public text: string, centered:boolean = false) {
        super(text);
        this.attribs.className = (centered ? "horizontal center-justified layout" : "") + " dialog-header";
    }
}
