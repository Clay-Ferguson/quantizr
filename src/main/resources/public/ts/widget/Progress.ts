import { ReactNode } from "react";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "./base/Comp";

let S : Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class Progress extends Comp {

    constructor() {
        super({
            className: "progress-bar progress-bar-striped progress-bar-animated",
            role: "progressbar",
            "aria-valuenow": "100",
            "aria-valuemin": "0",
            "aria-valuemax": "100",
            style: {width: "100%"}
        });
    }

    compRender(): ReactNode {
        return S.e("div", this.attribs);
    }
}
