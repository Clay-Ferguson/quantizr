import { Comp } from "./base/Comp";
import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { ReactNode } from "react";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class ToggleIcon extends Comp {

    constructor(private toggleOnClass: string, private toggleOffClass: string, attribs: Object = null) {
        super(attribs);
        //for now we're letting the container class do the toggling.
        //this.attribs.onClick = this.onClick;
        this.mergeState({
            className: this.attribs.className,
            toggle: false
        });
    }

    // onClick = (evt): void => {
    //     let state = this.getState();
    //     this.mergeState({toggle: !state.toggle});
    // }

    toggleClass = (): void => {
        let state = this.getState();
        this.mergeState({ toggle: !state.toggle });
    }

    compRender(): ReactNode {
        let state = this.getState();
        this.attribs.className = state.className + " " + (state.toggle ? this.toggleOnClass : this.toggleOffClass);
        /* Yes Icon used 'i' tag, this is not a mistake */
        return S.e('i', this.attribs);
    }
}
