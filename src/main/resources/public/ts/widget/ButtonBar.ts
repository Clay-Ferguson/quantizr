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
    constructor(initialButtons: Comp[] = null, private wrapperClass: string = "", private extraClass:string = "") {
        super(null);
        this.attribs.className = "btn-group " + extraClass;
        this.attribs.role = "group";
        this.setChildren(initialButtons);
    }

    compRender = (): ReactNode => {
        //console.log("compRender: "+this.jsClassName);
        if (!this.childrenExist()) return null;

        if (this.wrapperClass) {
            return S.e('div', { 
                className: "wrapper " + this.wrapperClass,
                key: this.getId()+"_wrp" 
            },
                S.e('div', this.attribs, this.makeReactChildren()));
        }
        else {
            return S.e('div', this.attribs, this.makeReactChildren());
        }
    }
}

