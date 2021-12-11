import React from "react";
import { S } from "../Singletons";
import { Comp } from "./base/Comp";
import { CompIntf } from "./base/CompIntf";

// see: https://www.npmjs.com/package/react-emoji-render
// https://codesandbox.io/s/xjpy58llxq

// ************ DO NOT DELETE
//
// const parseEmojisAndHtml = value => {
//     const emojisArray = toArray(value);
//     const newValue = emojisArray.map((node: any) => {
//         if (typeof node === "string") {
//             return <span dangerouslySetInnerHTML={{ __html: node }} />;
//         }
//         return node.props.children;
//     });
//     return newValue;
// };

interface LS {
    content?: string;
}

export class Html extends Comp {
    constructor(content: string = "", attribs: Object = {}, initialChildren: CompIntf[] = null) {
        super(attribs);
        this.domPreUpdateEvent = this.domPreUpdateEvent.bind(this);
        this.setChildren(initialChildren);
        this.setText(content);
    }

    setText = (content: string) => {
        this.mergeState<LS>({ content });
    }

    compRender(): React.ReactNode {
        if (this.hasChildren()) {
            console.error("dangerouslySetInnerHTML component had children. This is a bug: id=" + this.getId() + " constructor.name=" + this.constructor.name);
        }
        this.attribs.dangerouslySetInnerHTML = { __html: (this.getState<LS>() as any).content };
        return this.e("div", this.attribs);

        // ************* DO NOT DELETE. Method 1 and 2 both work, except #2 would need to be updated to
        // enable the attribs! These are the two older ways of parsing emojis. For now we're just letting
        // the font itself do all the work, and don't need this.
        // METHOD 1:
        // this.attribs.dangerouslySetInnerHTML = { __html: S.render.parseEmojis(this.getState<LS>().content) };
        // return this.e("div", this.attribs);
        //
        // METHOD 2: (note: You'll need to rename this file to '.tsx' extention to use JSX here)
        // return <div>{parseEmojisAndHtml(this.getState<LS>().content)}</div>;
    }

    /* change all "a" tags inside this div to have a target=_blank */
    domPreUpdateEvent(): void {
        let elm = this.getRef();
        if (!elm) return;
        S.domUtil.forEachElmBySel("#" + this.getId() + " a", (el, i) => {
            let href = el.getAttribute("href");

            // Detect this is a link to this instance we are being served from...
            if (href && href.indexOf && (href.indexOf("/") === 0 || href.indexOf(window.location.origin) !== -1)) {
                /* This code makes it where it where links to our own app that point to
                specific named locations on the tree will NOT open in separate browser tab but
                will open in the current browser tab as is the default without the 'target='
                attribute on an anchor tag. */
                if (href.indexOf("/app?id=:") !== -1 ||
                    href.indexOf("/app?id=~") !== -1 ||
                    href.indexOf("/app?tab=") !== -1) {
                    return;
                }
            }
            el.setAttribute("target", "_blank");
        });
        super.domPreUpdateEvent();
    }
}
