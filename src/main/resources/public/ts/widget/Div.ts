import { Comp } from "./base/Comp";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C} from "../Constants";
import { CompIntf } from "./base/CompIntf";
import { ReactNode } from "react";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class Div extends Comp {

    constructor(public content: string = "", attribs: Object = {}, initialChildren: CompIntf[] = null) {
        super(attribs);
        this.setChildren(initialChildren);
        this.setContent(content);
    }

    getTag = (): string => {
        return "div";
    }

    setContent = (content: string) => {
        this.mergeState({
            content
        });
    }

    compRender = (): ReactNode => {
        return this.tagRender('div', this.getState().content, this.attribs);
    }
}
