import { ReactNode } from "react";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "./base/Comp";
import { CompIntf } from "./base/CompIntf";

// https://github.com/mathjax/MathJax-demos-web
// https://github.com/mathjax/MathJax-node
//
// Supposedly mathjax-node should work, but I never got this import to
// compile without errors, so I just went back to loading MathJax from CDN
// as a script tag in the HTML.
//
// import { MathJax } from "mathjax-node";
// MathJax.config({
//     MathJax: {
//         tex: {
//             inlineMath: [['[math]', '[/math]']]
//         }
//     }
// });
// MathJax.start();

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

declare var MathJax;

/* Div that holds Pre-Rendered HTML that came from markdown rendering */
export class MarkdownDiv extends Comp {

    constructor(content: string = "", attribs: Object = {}, initialChildren: CompIntf[] = null) {
        super(attribs);
        this.setChildren(initialChildren);
        this.setText(content);
    }

    setText = (content: string) => {
        this.mergeState({ content });
    }

    compRender(): ReactNode {
        if (this.getChildren() && this.getChildren().length > 0) {
            console.error("dangerouslySetInnerHTML component had children. This is a bug: id=" + this.getId() + " constructor.name=" + this.constructor.name);
        }

        // console.log("Rendering MarkdownDiv: "+this.getState().content);
        this.attribs.dangerouslySetInnerHTML = { __html: this.getState().content };
        return S.e("div", this.attribs);
    }

    /* We do two things in here: 1) update formula rendering, and 2) change all "a" tags inside this div to have a target=_blank */
    domPreUpdateEvent = (): void => {
        this.whenElm((elm) => {
            if (MathJax && MathJax.typeset) {
                // note: MathJax.typesetPromise(), also exists
                MathJax.typeset([elm]);

                S.util.forEachElmBySel("#" + this.getId() + " a", (el, i) => {
                    el.setAttribute("target", "_blank");
                });
            }
        });
    }
}
