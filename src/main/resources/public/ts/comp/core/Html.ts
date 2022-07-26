import DOMPurify from "dompurify";
import { Util } from "../../Util";
import { Comp } from "../base/Comp";
import { CompIntf } from "../base/CompIntf";
import { Italic } from "./Italic";

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

interface LS { // Local State
    content?: string;
}

export class Html extends Comp {
    constructor(content: string = "", attribs: Object = {}, initialChildren: CompIntf[] = null) {
        super(attribs);
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

        this.attribs.dangerouslySetInnerHTML = Comp.getDangerousHtml(this.getState<LS>().content);
        return this.tag("div");

        // ************* DO NOT DELETE. Method 1 and 2 both work, except #2 would need to be updated to
        // enable the attribs! These are the two older ways of parsing emojis. For now we're just letting
        // the font itself do all the work, and don't need this.
        // METHOD 1:
        // this.attribs.dangerouslySetInnerHTML = { __html: S.render.parseEmojis(this.getState<LS>().content) };
        // return this.tag("div", this.attribs);
        //
        // METHOD 2: (note: You'll need to rename this file to '.tsx' extention to use JSX here)
        // return <div>{parseEmojisAndHtml(this.getState<LS>().content)}</div>;
    }

    // DO NOT DELETE. KEEP AS EXAMPLE HOW TO ALTER DOM AFTER RENDER
    // Currently this '_blank' target is being done by the custom markdown renderer, not here.
    // Future use of this code pattern...
    // see also: #onclick-security-note
    // Note: This may end up being the best-practice place to inject the onClick for the userNames (@mentions) to make them clickable, while having
    // the sanitizer logic specifically REMOVE onclick attributes (which it does), because we can cram in only the ones we know we want right here
    // and not have to truse any externally created HTML content from other servers.
    //
    // make all "a" tags inside this div to have a target=_blank
    //
    // domPreUpdateEvent(): void {
    //     let elm = this.getRef();
    //     if (!elm) return;
    //     S.domUtil.forEachElmBySel("#" + this.getId() + " a", (el, i) => {
    //         // let href = el.getAttribute("href");
    //         el.setAttribute("target", "_blank");
    //     });
    // }
}
