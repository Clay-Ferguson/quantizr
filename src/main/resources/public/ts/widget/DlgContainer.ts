import { Comp } from "./base/Comp";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { ReactNode } from "react";
import { Div } from "./Div";
import { store } from "../AppRedux";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

//note: class not in use yet
export class DlgContainer extends Comp {

    constructor(attribs: Object = {}) {
        super(attribs);
    }

    compRender(): ReactNode {
        this.setChildren([
            new Div("This is a test"),
        ]);

        return this.tagRender('div', null, this.attribs);
    }
}
