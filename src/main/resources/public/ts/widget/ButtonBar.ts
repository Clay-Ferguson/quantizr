import { Comp } from "./base/Comp";
import { Constants } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { ReactNode } from "react";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class ButtonBar extends Comp {

    //wrapperClass can be 'text-center' for centering.
    constructor(initialButtons: Comp[] = null, private wrapperClass: string = "") {
        super(null);
        this.attribs.className = "btn-group";
        this.attribs.role = "group";
        this.attribs.style = { margin: '10px' };
        this.setChildren(initialButtons);
    }

    compRender = (): ReactNode => {
        //console.log("compRender: "+this.jsClassName);
        if (!this.childrenExist()) return null;

        if (this.wrapperClass) {
            return S.e('div', { className: "wrapper " + this.wrapperClass },
                S.e('div', this.attribs, this.makeReactChildren()));
        }
        else {
            return S.e('div', this.attribs, this.makeReactChildren());
        }
    }
}

