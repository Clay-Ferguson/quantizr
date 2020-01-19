import { Comp } from "../widget/base/Comp";
import { Constants } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { ReactNode } from "react";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class TextContent extends Comp {

    constructor(text: string, classes: string = null, public preformatted: boolean = false) {
        super(null);
        this.attribs.className = classes || "alert alert-info";
        this.attribs.role = "alert";
        this.setText(text);
    }

    setText = (text: string) => {
        this.mergeState({
            text
        });
    }

    compRender = (): ReactNode => {
        let state = this.getState();

        //todo-0: research this hack. It's ok if we need to dangerously render sometimes, but not based on 
        //checking for HTML delimiters. That was just a crazy temp hack.
        if (state.text && state.text.indexOf("<") != -1) {
            //console.log("Dangerously setting html: "+this.jsClassName);
            let _p: any = { key: "renderhtml" + this.getId() };
            _p.dangerouslySetInnerHTML = { "__html": state.text };
            return S.e(this.preformatted ? 'pre' : 'div', _p);
        }
        else {
            //console.log("Building (TextContent) react element: " + this.attribs.id);
            return S.e(this.preformatted ? 'pre' : 'div', this.attribs, state.text);
        }
    }
}
