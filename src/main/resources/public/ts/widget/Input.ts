import { Comp } from "./base/Comp";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { ReactNode } from "react";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class Input extends Comp {

    constructor(attribs: Object = {}) {
        super(attribs);
        this.attribs.onChange = this.onChange.bind(this);
        this.mergeState({
            value: this.attribs.value || "",
            type: this.attribs.type
        });
    }

    onChange(evt): void {
        //console.log("New Val [" + evt.target.value + "] this.id=" + this.getId());
        this.mergeState({ value: evt.target.value });
    }

    /* This method is never used because we ended up always passing Input params into a new Input object
    in all circumstances, but I leave it here for future reference. It's still a legit function. */
    _toggleType = (): void => {
        let state = this.getState();
        this.mergeState({
            type: state.type == "password" ? "text" : "password"
        });
    }

    compRender(): ReactNode {
        /* I have several places in other classes where 'conten' and 'attribs' is in reverse/wrong order. check */
        let state = this.getState();
        this.attribs.value = state.value;
        this.attribs.type = state.type;
        return S.e("input", this.attribs);
    }
}
