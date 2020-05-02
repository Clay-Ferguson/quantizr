import * as J from "../JavaIntf";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { ReactNode } from "react";
import { Div } from "../widget/Div";
import { NodeCompMainNode } from "./NodeCompMainNode";
import { NodeCompMainList } from "./NodeCompMainList";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class MainTabComp extends Div {

    constructor() {
        super(null, {
            id: "mainTab",
            className: "tab-pane fade my-tab-pane"
        });
    }

    super_CompRender: any = this.compRender;
    compRender = (): ReactNode => {
        
        this.setChildren([
            new NodeCompMainNode(),
            new NodeCompMainList()
        ]);

        return this.super_CompRender();
    }
}
