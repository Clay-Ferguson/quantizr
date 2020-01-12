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

    constructor(text: string, classes: string=null, public preformatted: boolean=false) {
        super(null);
        this.attribs.className = classes || "alert alert-info";
        this.attribs.role = "alert";
        this.setText(text);
    }

    setText = (text: string) => {
        this.setState({
            text
        });
    }

    compRender = (): ReactNode => {
        let state = this.getState();

        //todo-1: this is an ugly hack to check for "<". Need to review this.
        if (state.text && state.text.indexOf("<") != -1) {
            let _p: any = {};
            _p.dangerouslySetInnerHTML = { "__html": state.text };
            return S.e(this.preformatted ? 'pre' : 'div', _p);
        }
        else {
            //console.log("Building (TextContent) react element: " + this.attribs.id);
            return S.e(this.preformatted ? 'pre' : 'div', this.attribs, state.text);
        }
    }
}
