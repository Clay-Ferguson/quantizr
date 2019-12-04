console.log("Selection.ts");

import { Comp } from "./base/Comp";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants } from "../Constants";

let S : Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class SelectionOption extends Comp {
    constructor(public key: string, public val : string) {
        super(null);
        this.attribs.value = this.key;
    }

    render = (p) => {
        return S.e('option', p, this.val);
    }
}
