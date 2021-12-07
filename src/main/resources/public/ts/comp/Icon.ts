import { ReactNode } from "react";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "./base/Comp";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class Icon extends Comp {

    constructor(attribs: Object = null, private label: string = null, private outterClasses: string = null) {
        super(attribs);
    }

    compRender(): ReactNode {
        /* Yes Icon uses "i" tag, this is not a mistake */
        if (this.label) {
            let outterSpanClass: any = {};
            outterSpanClass.key = this.getId() + "_s1";
            if (this.outterClasses) {
                outterSpanClass.className = this.outterClasses;
            }

            /* if we had assigned an onClick function, make it apply to the entre icon and label */
            if (this.attribs.onClick) {
                outterSpanClass.onClick = this.attribs.onClick;
                this.attribs.onClick = null;
            }

            /* same for title */
            if (this.attribs.title) {
                outterSpanClass.title = this.attribs.title;
                this.attribs.title = null;
            }

            return this.e("span", outterSpanClass, [
                this.e("i", this.attribs), // <--- attribs already has unique key assigned in base class
                this.e("span", {
                    className: "iconLabel",
                    key: this.getId() + "_s2"
                }, this.label)
            ]);
        }
        else {
            return this.e("i", this.attribs);
        }
    }
}
