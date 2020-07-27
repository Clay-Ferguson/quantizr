import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Div } from "./Div";
import { ValueIntf } from "../Interfaces";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class ListBox extends Div {

    constructor(public valueIntf: ValueIntf) {
        super();
        this.setClass("list-group marginBottom");
    }

    //Handler to update state
    updateValFunc(value: string): void {
        /* For list boxes that just present a list and don't have the goal of letting the user 'choose' one, we won't have a valueIntf */
        if (!this.valueIntf) {
            return;
        }

        if (value != this.valueIntf.getValue()) {
            this.valueIntf.setValue(value);

            //needing this line took a while to figure out. If nothing is setting any actual detectable state change
            //during his call we have to do this here.
            this.forceRender();
        }
    }
}
