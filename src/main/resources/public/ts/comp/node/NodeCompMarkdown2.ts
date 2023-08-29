import { getAs } from "../../AppContext";
import { TabIntf } from "../../intf/TabIntf";
import * as J from "../../JavaIntf";
import { S } from "../../Singletons";
import { ReactNode, createElement } from "react";
import { Comp } from "../base/Comp";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { dark } from "react-syntax-highlighter/dist/esm/styles/prism";

interface LS {
    content: string;
    pendingDecrypt?: string;
}

/* todo-0: This is the candidate to replace "NodeCompMarkdown" once "react-markdown" is vetted well enough to replace "marked" */
export class NodeCompMarkdown2 extends Comp {
    // detects URLs in a string (from Stack Overflow, not fully vetted yet)
    static urlRegex = /(https?:\/\/[^\s]+)/g;

    // I had this named 'content' but it confused TypeScript and interfered with the Html constructor,
    // but is ok named as 'cont'
    cont: string;

    /* This makes the encrypted text visible without editing the node which is important to have
    on so nodes shared to you can be seen, because a user can't edit nodes they don't own */
    private autoDecrypting: boolean = true;

    // When the rendered content contains urls we will load the "Open Graph" data and display it below the content.
    urls: Set<String>;

    constructor(public node: J.NodeInfo, extraContainerClass: string, tabData: TabIntf<any>, private ogFactory: (url: string, offset: number) => ReactNode) {
        super({ key: "ncmkd_" + node.id });
        this.cont = node.renderContent || node.content;
        const ast = getAs();
        this.attribs.className = "mkCont";

        if (extraContainerClass) {
            this.attribs.className += " " + extraContainerClass;
        }

        const content = this.cont || "";
        const state: LS = {
            content: null
        };

        /* If this content is encrypted we set it in 'pendingDecrypt' to decrypt it asynchronously */
        if (S.props.isEncrypted(node)) {
            state.content = "[Encrypted]";

            if (!ast.isAnonUser) {
                state.pendingDecrypt = content;
            }
        }
        /* otherwise it's not encrypted and we display the normal way */
        else {
            state.content = this.renderRawMarkdown(node);
        }

        this.mergeState<LS>(state);
    }

    /* If content is passed in it will be used. It will only be passed in when the node is encrypted and the text
    has been decrypted and needs to be rendered, in which case we don't need the node.content, but use the 'content' parameter here */
    renderRawMarkdown(node: J.NodeInfo, content: string = null): string {
        content = content || this.cont || "";
        let val = "";
        this.urls = null;
        val = S.render.injectSubstitutions(node, content);

        // #inline-image-rendering
        // val = this.replaceOgImgFileNames(val); // <-- DO NOT DELETE

        val = S.util.insertActPubTags(val, node);
        return val;
    }

    // DO NOT DELETE (#inline-image-rendering)
    // replaceOgImgFileNames = (val: string): string => {
    //     // find all the urls in the val, and remove the ones that we know are doing go
    //     // be rendered as plain Images when OpenGraph rendering is complete.
    //     return val.replace(NodeCompMarkdown.urlRegex, (url: string) => {
    //         if (S.quanta.imageUrls.has(url)) {
    //             // todo-2: we can add 'click to expand' functionality here.
    //             // It's probably better to render the image but LEAVE the 'url' in front of it
    //             // because that's addative to the page, and the scrollbars will behave much better
    //             // in cases where the page is only growing and nothing ever shifts UP.
    //             return url + `<img src='${url}' class='insImgInRow'>`;
    //         }
    //         else {
    //             return url;
    //         }
    //     });
    // }

    override preRender(): boolean {
        const state: LS = this.getState<LS>();

        if (this.autoDecrypting && state.pendingDecrypt) {
            let cipherText = null;
            if (state.pendingDecrypt.startsWith(J.Constant.ENC_TAG)) {
                cipherText = state.pendingDecrypt.substring(J.Constant.ENC_TAG.length);
            }

            if (!cipherText) {
                console.log("not decrypting. cipherText was unexpected format: " + cipherText);
                return;
            }

            const cipherHash = S.util.hashOfString(cipherText);
            let clearText = S.quanta.decryptCache.get(cipherHash);
            // if we have already decrypted this data use the result.
            if (clearText) {
                clearText = this.renderRawMarkdown(this.node, clearText);

                this.mergeState<LS>({
                    content: clearText,
                    pendingDecrypt: null
                });
            }
            else {
                setTimeout(() => {
                    this.decrypt();
                }, 10);
            }
        }
        return true;
    }

    override compRender = (): ReactNode => {
        const state = this.getState<LS>();

        this.attribs.components = {
            code: ({ node, inline, className, children, ...props }) => {
                let match = /language-(\w+)/.exec(className || "");
                const language = match ? match[1] : "txt";
                return !inline ? (
                    createElement(SyntaxHighlighter, {
                        ...props,
                        style: dark,
                        language,
                        PreTag: "div"
                    }, String(children).replace(/\n$/, ""))
                ) : (
                    createElement("code", { ...props, className: className }, children)
                );
            }
        }

        // Sets up custom rendering of Anchor Tag, but really all we're doing here is hooking in so we
        // can collect WHAT the URLs are.
        if (this.ogFactory) {
            this.attribs.components.a = (props: any) => {
                // console.log("PROPS: " + S.util.prettyPrint(props));
                // todo-0: this really shold be splitting apart className, and comparing item by item
                // because it will be the space delimited list of class names. I'm cheating for now.
                const isPersonLink = props.className && (props.className.indexOf("mention") != -1 ||
                    props.className.indexOf("hashtag") != -1 ||
                    props.className.indexOf("noog") != -1 || // no opengraph 
                    props.className.indexOf("u-url") != -1);

                if (!isPersonLink && !S.props.getAttachmentByUrl(this.node, props.href)) {
                    // lazy instantiate
                    this.urls = this.urls || new Set<String>();
                    this.urls.add(props.href);

                    // we use offset as a 'unique' idenfitier per link
                    const offset: number = props.node.children[0].position.start.offset;

                    return createElement("span", null, [
                        createElement("a", { key: "a-mk+" + offset, href: props.href }, props.children),
                        this.ogFactory(props.href, offset)
                    ]);
                }
                else {
                    return createElement("a", { href: props.href }, props.children);
                }
            }
        }

        // rehypeRaw is what allows HTML to be embedded in the markdown
        this.attribs.rehypePlugins = [rehypeRaw];
        return createElement(ReactMarkdown as any, this.attribs, state.content);
    }

    decrypt = async () => {
        if (!S.crypto.avail) return;
        const state: LS = this.getState<LS>();
        if (!state.pendingDecrypt) return;
        let clearText = null;
        // console.log("decrypting (in NodeCompMarkdown): " + state.pendingDecrypt);

        if (state.pendingDecrypt.startsWith(J.Constant.ENC_TAG)) {
            const cipherText = state.pendingDecrypt.substring(J.Constant.ENC_TAG.length);
            const cipherKey = S.props.getCryptoKey(this.node);
            if (cipherKey) {
                // console.log("CIPHERKEY " + cipherKey);
                clearText = await S.crypto.decryptSharableString(null, { cipherKey, cipherText });
            }
        }

        // console.log("Decrypted to " + clearText);
        // Warning clearText can be "" (which is a 'falsy' value and a valid decrypted string!)
        clearText = clearText !== null ? clearText : "[Decrypt Failed]";
        clearText = this.renderRawMarkdown(this.node, clearText);

        this.mergeState<LS>({
            content: clearText,
            pendingDecrypt: null
        });
    }
}
