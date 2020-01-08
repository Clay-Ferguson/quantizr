import { Comp } from "./base/Comp";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants } from "../Constants";
import { ReactNode } from "react";

let S : Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
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

    compRender = (p: any): ReactNode => {
        return S.e('div', p);
    }
}
