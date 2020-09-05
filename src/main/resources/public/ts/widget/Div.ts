import { ReactNode } from "react";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { BaseCompState } from "./base/BaseCompState";
import { Comp } from "./base/Comp";
import { CompIntf } from "./base/CompIntf";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class Div<S extends BaseCompState = any> extends Comp<S> {

    constructor(content: string = "", attribs: Object = {}, public initialChildren: CompIntf[] = null) {
        super(attribs);
        this.setChildren(this.initialChildren);
        this.mergeState({content} as any);
    }

    compRender(): ReactNode {
        return this.tagRender("div", (this.getState() as any).content, this.attribs);
    }
}
