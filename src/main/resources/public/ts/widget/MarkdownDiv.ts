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

/* Div that holds Pre-Rendered HTML that came from markdown rendering */
export class MarkdownDiv extends Comp {

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

    compRender = (): ReactNode => {
        if (this.children) {
            console.error("dangerouslySetInnerHTML component had children. This is a bug.");
        }

        this.attribs.dangerouslySetInnerHTML = { "__html": this.getState().content };
        return S.e('div', this.attribs);
    }
}
