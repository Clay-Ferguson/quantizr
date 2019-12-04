console.log("ButtonBar.ts");

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

    constructor(initialButtons: Comp[] = null, justify: string = "center-justified") {
        super(null);
        this.attribs.className = "btn-group";
        this.attribs.role = "group";
        this.attribs.style = { marginTop: '5px', marginLeft: '10px' };
        this.setChildren(initialButtons);
    }

    render = (p: any): ReactNode => {
        if (this.childrenExist()) {
            return S.e('div', p, this.makeReactChildren());
        }
        else {
            return null;
        }
    }
}

