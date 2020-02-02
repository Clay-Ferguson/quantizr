import { Comp } from "./base/Comp";
import { RadioButton } from "./RadioButton";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants } from "../Constants";
import { ReactNode } from "react";

let S : Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class RadioButtonGroup extends Comp {

    constructor(initialButtons: RadioButton[] = null, moreClasses: string="") {
        super(null);
        this.attribs.className = moreClasses; 
        this.setChildren(initialButtons);

        initialButtons.forEach((row: RadioButton) => {
            if (row.attribs.checked == "checked") {
                this.attribs.selected = (<any>row.attribs).name;
            }
        });
    }

    compRender = (): ReactNode => {
        return S.e('div', this.attribs, this.makeReactChildren());
    }
}
