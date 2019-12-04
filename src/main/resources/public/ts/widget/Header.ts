console.log("Header.ts");

import { Comp } from "./base/Comp";
import { Constants } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";

let S : Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class Header extends Comp {

    constructor(public text: string, centered:boolean = false) {
        super(null);
        this.attribs.className = (centered ? "horizontal center-justified layout" : "") + " dialog-header";
    }

    render = (p) => {
        return this.tagRender('div', null, p);
    }
}
