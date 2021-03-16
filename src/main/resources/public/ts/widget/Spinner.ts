import { ReactNode } from "react";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "./base/Comp";

let S : Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class Spinner extends Comp {

    constructor() {
        super({
            className: "spinner-border text-success",
            role: "status"
        });
    }

    compRender(): ReactNode {
        return this.e("div", this.attribs);
    }
}
