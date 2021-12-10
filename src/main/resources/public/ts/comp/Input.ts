import { ReactNode } from "react";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { State } from "../State";
import { Comp } from "./base/Comp";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

interface LS {
    value: string;
}

export class Input extends Comp {

    constructor(attribs: Object = {}, s?: State) {
        super(attribs, s);
        this.attribs.onChange = (evt) => {
            this.mergeState<LS>({ value: evt.target.value });
        };
    }

    compRender(): ReactNode {
        this.attribs.value = this.getState<LS>().value || "";
        return this.e("input", this.attribs);
    }
}