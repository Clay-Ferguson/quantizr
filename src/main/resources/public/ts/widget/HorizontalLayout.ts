import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "./base/Comp";
import { Div } from "./Div";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class HorizontalLayout extends Div {

    constructor(initialComps: Comp[] = null, moreClasses: string = "", attribs: any = {}) {
        super(null, attribs || {});

        this.attribs.className = "displayTable " + (moreClasses || "");
        if (initialComps) {
            for (let comp of initialComps) {
                if (!comp) continue;
                if (!comp.attribs) {
                    comp.attribs = {};
                }

                if (!comp.attribs.className) {
                    comp.attribs.className = "displayCell";
                }
                else {
                    if (comp.attribs.className.indexOf("displayCell") === -1) {
                        comp.attribs.className += " displayCell";
                    }
                }
            }
        }

        this.setChildren([new Div(null, { className: "displayRow" }, initialComps)]);
    }
}
