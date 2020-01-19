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

    constructor(initialButtons: Comp[] = null, justify: string = "center-justified", marginLeft: string = "0px") {
        super(null);
        this.attribs.className = "btn-group";
        this.attribs.role = "group";
        this.attribs.style = { marginTop: '8px', marginLeft };
        this.setChildren(initialButtons);
    }

    compRender = (): ReactNode => {
        //console.log("compRender: "+this.jsClassName);
        if (this.childrenExist()) {
            return S.e('div', this.attribs, this.makeReactChildren());
        }
        else {
            //console.warn("no children in ButtonBar: "+this.jsClassName)
            return null;
        }
    }
}

