import { ReactNode } from "react";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "./base/Comp";
import { RadioButton } from "./RadioButton";

let S : Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class RadioButtonGroup extends Comp {

    constructor(initialButtons: RadioButton[] = null, moreClasses: string = "") {
        super(null);
        this.attribs.className = moreClasses; 
        this.setChildren(initialButtons);

        initialButtons.forEach(function(row: RadioButton) {
            if (row.attribs.checked === "checked") {
                this.attribs.selected = (<any>row.attribs).name;
            }
        }, this);
    }

    compRender(): ReactNode {
        return S.e("div", this.attribs, this.buildChildren());
    }
}
