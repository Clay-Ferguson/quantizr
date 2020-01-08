import { Comp } from "./base/Comp";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants } from "../Constants";
import { CompIntf } from "./base/CompIntf";
import { ReactNode } from "react";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class Div extends Comp {

    constructor(public content: string = "", attribs: Object = {}, initialChildren: CompIntf[] = null) {
        super(attribs);
        this.setChildren(initialChildren);

        this.setState({
            content
        });
    }

    getTag = (): string => {
        return "div";
    }

    setInnerContent = (content: string) => {
        this.setState({
            content
        });
    }

    compRender = (p: any): ReactNode => {
        return this.tagRender('div', this.getState().content, p);
    }
}
