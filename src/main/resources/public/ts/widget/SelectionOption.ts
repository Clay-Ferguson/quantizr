import { Comp } from "./base/Comp";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C} from "../Constants";
import { ReactNode } from "react";

let S : Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class SelectionOption extends Comp {
    constructor(public key: string, public val : string) {
        super(null);
        this.attribs.value = this.key;

        // React prints this warning if you use 'selected' on an option
        // Use the `defaultValue` or `value` props on <select> instead of setting `selected` on <option> in option
        // if (selected) {
        //     this.attribs.selected = "selected";
        // }
    }

    compRender(): ReactNode {
        return S.e('option', this.attribs, this.val);
    }
}
