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

export class TextareaTag extends Comp {

    constructor(attribs: Object = {}, s?: State<any>) {
        super(attribs, s);
        this.attribs.onChange = this.onChange.bind(this);
    }

    onChange(evt): void {
        // console.log("New Val [" + evt.target.value + "] this.id=" + this.getId());
        this.mergeState({ value: evt.target.value });
    }

    compRender(): ReactNode {
        /* I have several places in other classes where 'conten' and 'attribs' is in reverse/wrong order. check */
        let state = this.getState();
        this.attribs.value = state.value;
        return S.e("textarea", this.attribs);
    }
}
