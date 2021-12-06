import { ReactNode } from "react";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "../widget/base/Comp";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

interface LS {
    text: string;
}

export class TextContent extends Comp {

    constructor(text: string, classes: string = null, public preformatted: boolean = false) {
        super(null);
        this.attribs.className = classes || "alert alert-secondary";
        this.setText(text);
    }

    setText = (text: string) => {
        this.mergeState<LS>({ text });
    }

    compRender(): ReactNode {
        let state = this.getState<LS>();

        // todo-2: Not sure I want to keep detecting HTML this way, because we can just use
        // the HTML class explicity when we need to support HTML
        if (state.text && state.text.indexOf("<") !== -1) {
            // console.log("Dangerously setting html: "+this.jsClassName);
            let _p: any = { id: this.getId(), key: this.getId() };
            _p.dangerouslySetInnerHTML = { __html: state.text };
            return this.e(this.preformatted ? "pre" : "div", { ...this.attribs, ..._p });
        }
        else {
            // console.log("Building (TextContent) react element: " + this.attribs.id);
            return this.e(this.preformatted ? "pre" : "div", this.attribs, state.text);
        }
    }
}
