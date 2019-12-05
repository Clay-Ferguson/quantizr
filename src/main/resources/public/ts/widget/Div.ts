console.log("Div.ts");

import { Comp } from "./base/Comp";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants } from "../Constants";
import { CompIntf } from "./base/CompIntf";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class Div extends Comp {

    constructor(public content: string = "", attribs: Object = {}, initialChildren: CompIntf[] = null) {
        super(attribs);
        this.setChildren(initialChildren);

        this.state = {
            content
        };
    }

    getTag = (): string => {
        return "div";
    }

    setInnerContent = (content: string) => {
        //todo-0: If this is called too early setState can be null. Need to fix.
        this.setState({
            content
        });
    }

    render = (p) => {
        this.hookState(this.state);

        /* Note this renders content AND CHILDREN if there are any. 
        
        NOTE: for a LONG time i have had 'p' here instead of 'attribs' and finally realized that was not right?
        */
        return this.tagRender('div', this.state.content, this.attribs);
    }
}
