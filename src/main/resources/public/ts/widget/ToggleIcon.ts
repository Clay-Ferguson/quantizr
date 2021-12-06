import { ReactNode } from "react";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "./base/Comp";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

interface LS {
    toggle?: boolean;
    className?: string;
}

export class ToggleIcon extends Comp {

    constructor(private toggleOnClass: string, private toggleOffClass: string, attribs: Object = null) {
        super(attribs);
        this.mergeState<LS>({
            className: this.attribs.className,
            toggle: false
        });
    }

    _toggleClass = (): void => {
        let state = this.getState<LS>();
        this.mergeState<LS>({ toggle: !state.toggle });
    }

    compRender(): ReactNode {
        let state = this.getState<LS>();
        this.attribs.className = state.className + " " + (state.toggle ? this.toggleOnClass : this.toggleOffClass);
        /* Yes Icon used "i" tag, this is not a mistake */
        return this.e("i", this.attribs);
    }
}
