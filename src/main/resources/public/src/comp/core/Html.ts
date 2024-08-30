import { Comp } from "../base/Comp";
import { NodeCompBinary } from "../node/NodeCompBinary";
import { Constants as C } from "../../Constants";

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
    private hasEnlargableImg = false;

    constructor(content: string = "", attribs: any = {}, private onClick: (evt: Event) => void = null, private sanitize: boolean = false) {
        super(attribs);
        this.setText(content);
    }

    setText(content: string) {
        this.mergeState<LS>({ content });
    }

    override preRender(): boolean | null {
        if (this.hasChildren()) {
            console.error("Html component had children. This is always a bug: id=" + this.getId() + " constructor.name=" + this.constructor.name);
        }

        const content = this.getState<LS>().content;
        this.hasEnlargableImg = content.indexOf("enlargableImg") >= 0;

        this.attribs.dangerouslySetInnerHTML = this.sanitize ? Comp.getDangerousHtml(content)
            : { __html: content };

        // ************* DO NOT DELETE. Method 1 and 2 both work, except #2 would need to be updated
        // to enable the attribs! These are the two older ways of parsing emojis. For now we're just
        // letting the font itself do all the work, and don't need this. METHOD 1:
        // this.attribs.dangerouslySetInnerHTML = { __html:
        // S.render.parseEmojis(this.getState<LS>().content) }; return this.tag("div",
        // this.attribs);
        //
        // METHOD 2: (note: You'll need to rename this file to '.tsx' extention to use JSX here)
        // return <div>{parseEmojisAndHtml(this.getState<LS>().content)}</div>;
        return true;
    }

    override _domPreUpdateEvent = (): void => {
        const elm = this.getRef();
        if (!elm) return;

        if (this.onClick) {
            elm.addEventListener("click", this.onClick);
        }

        if (this.hasEnlargableImg) {
            elm.querySelectorAll(".enlargableImg").forEach((e: Element) => {
                e.addEventListener("click", (evt: any) => {
                    NodeCompBinary.clickOnImage(e as HTMLImageElement, evt, e.getAttribute(C.NODE_ID_ATTR), e.getAttribute("data-attkey"), false, false);
                });
            });
        }
    }
}
