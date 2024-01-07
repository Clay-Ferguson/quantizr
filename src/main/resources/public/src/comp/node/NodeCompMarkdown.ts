import { ReactNode, createElement } from "react";
import { getAs } from "../../AppContext";
import * as J from "../../JavaIntf";
import { S } from "../../Singletons";
import { TabIntf } from "../../intf/TabIntf";
import { Comp } from "../base/Comp";
import ReactMarkdownComp from "../core/ReactMarkdownComp";
import { NodeInfo } from "../../JavaIntf";

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

    constructor(public node: NodeInfo, extraContainerClass: string, _tabData: TabIntf<any>, urls: Set<string>) {
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
            state.content = this.preprocessMarkdown(node, null, urls);
        }

        this.mergeState<LS>(state);
    }

    /* If content is passed in it will be used. It will only be passed in when the node is encrypted and the text
    has been decrypted and needs to be rendered, in which case we don't need the node.content, but use the 'content' parameter here */
    preprocessMarkdown(node: NodeInfo, content: string = null, urls: Set<string>): string {
        content = content || this.cont || "";
        let val = "";
        val = S.render.injectSubstitutions(node, content);
        val = S.util.insertActPubTags(val, node);
        val = this.translateLaTex(val);
        val = this.insertMarkdownLinks(urls, val);
        return val;
    }

    insertMarkdownLinks = (urls: Set<string>, val: string): string => {
        if (!urls || !val) return val;
        urls.forEach((url: string) => {
            if (val.indexOf("(" + url) == -1) {
                val = val.replaceAll(url, `[${url}](${url})`);
            }
        });
        return val;
    }

    translateLaTex = (val: string): string => {
        val = val.replaceAll("\\(", "$");
        val = val.replaceAll("\\)", "$");
        val = val.replaceAll("\\[", "$$");
        val = val.replaceAll("\\]", "$$");
        return val;
    }

    override preRender = (): boolean => {
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
                clearText = this.preprocessMarkdown(this.node, clearText, null);

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

        // ReactMarkdown can't have this 'ref' and would throw a warning if we did
        delete this.attribs.ref;

        return createElement(ReactMarkdownComp as any, this.attribs, state.content);
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
        clearText = this.preprocessMarkdown(this.node, clearText, null);

        this.mergeState<LS>({
            content: clearText,
            pendingDecrypt: null
        });
    }
}
