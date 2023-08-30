import { ReactNode, createElement } from "react";
import { dark } from "react-syntax-highlighter/dist/esm/styles/prism";
import rehypeRaw from "rehype-raw";
import { getAs } from "../../AppContext";
import * as J from "../../JavaIntf";
import { S } from "../../Singletons";
import { TabIntf } from "../../intf/TabIntf";
import { Comp } from "../base/Comp";
import ReactMarkdownComp from "../core/ReactMarkdownComp";
import SyntaxHighlighterComp from "../core/SyntaxHighlighterComp";

interface LS {
    content: string;
    pendingDecrypt?: string;
}

export class NodeCompMarkdown extends Comp {
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

    constructor(public node: J.NodeInfo, extraContainerClass: string, tabData: TabIntf<any>) {
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
            state.content = this.preprocessMarkdown(node);
        }

        this.parseUrls(state.content);
        this.mergeState<LS>(state);
    }

    parseUrls = (content: string) => {
        this.urls = null;
        if (!content) return;
        const regex = /(?:https?):\/\/[^\s/$.?#].[^\s]*|www\.[^\s\/$?#].[^\s]*/gi;

        // (?:https?): Matches either "http", "https".
        // :\/\/: Matches "://" literally.
        // [^\s/$.?#]: Matches any character that is not whitespace, "/", "$", ".", "?", or "#".
        // .[^\s]*: Matches any character that is not whitespace zero or more times.
        // |: Alternation, allowing for the "www" format.
        // www\.[^\s\/$?#].[^\s]*: Matches URLs starting with "www".
        // gi: Flags for global and case-insensitive matching.

        const urls = content.match(regex);

        if (urls) {
            urls.forEach(url => {
                url = S.util.stripIfEndsWith(url, ")"); // todo-0: this is a hack until I fix my regex
                // Tricky way to pickup both markdown "[clickme](url)" strings and "<a href=" urls, 
                // and avoid doing OpenGraph rendering on them
                if (content.indexOf("(" + url) !== -1 || content.indexOf("=\"" + url) !== -1) return;
                this.urls = this.urls || new Set<String>();
                this.urls.add(url);
            });
        }
    }

    /* If content is passed in it will be used. It will only be passed in when the node is encrypted and the text
    has been decrypted and needs to be rendered, in which case we don't need the node.content, but use the 'content' parameter here */
    preprocessMarkdown(node: J.NodeInfo, content: string = null): string {
        content = content || this.cont || "";
        let val = "";
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
                clearText = this.preprocessMarkdown(this.node, clearText);

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
                    createElement(SyntaxHighlighterComp as any, {
                        ...props,
                        style: dark, // without the "as any" this is a syntax error. Check if this is even working. todo-0
                        language,
                        PreTag: "div"
                    }, String(children).replace(/\n$/, ""))
                ) : (
                    createElement("code", { ...props, className }, children)
                );
            }
        }

        // not needed but keep as an example        
        // this.attribs.components.a = (props: any) => {
        //     return createElement("a", { href: props.href }, props.children);
        // }

        // rehypeRaw is what allows HTML to be embedded in the markdown
        this.attribs.rehypePlugins = [rehypeRaw];

        // ReactMarkdown can't have this 'ref' and would throw a warning if we did
        delete this.attribs.ref;

        let ret = createElement(ReactMarkdownComp as any, this.attribs, state.content);
        return ret;
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
        clearText = this.preprocessMarkdown(this.node, clearText);

        this.mergeState<LS>({
            content: clearText,
            pendingDecrypt: null
        });
    }
}
