import { ReactNode, createElement } from "react";
import { dispatch, getAs } from "../../AppContext";
import * as J from "../../JavaIntf";
import { S } from "../../Singletons";
import { TabBase } from "../../intf/TabBase";
import { Comp, CompT } from "../base/Comp";
import ReactMarkdownComp from "../core/ReactMarkdownComp";
import { NodeInfo } from "../../JavaIntf";
import { UrlInfo } from "../../plugins/base/TypeBase";

interface LS {
    content: string;
    pendingDecrypt?: string;
}

export class NodeCompMarkdown extends Comp {
    // detects URLs in a string (from Stack Overflow, not fully vetted yet)
    static urlRegex = /(https?:\/\/[^\s]+)/g;
    static COLLAPSE_TITLE_START = "-**";
    static COLLAPSE_TITLE_END = "**-";
    static CENTERING_START = "->";
    static CENTERING_END = "<-";


    // I had this named 'content' but it confused TypeScript and interfered with the Html constructor,
    // but is ok named as 'cont'
    cont: string;

    /* This makes the encrypted text visible without editing the node which is important to have
    on so nodes shared to you can be seen, because a user can't edit nodes they don't own */
    private autoDecrypting: boolean = true;

    constructor(public node: NodeInfo, extraContainerClass: string, _tabData: TabBase<any>, urls: Map<string, UrlInfo>) {
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
    preprocessMarkdown(node: NodeInfo, content: string = null, urls: Map<string, UrlInfo>): string {
        content = content || this.cont || "";
        let val = "";
        val = S.render.injectSubstitutions(node, content);

        if (S.props.isMine(node)) {
            val = S.util.makeHtmlCommentsVisible(val);
        }
        val = this.translateLaTex(val);

        // NOTE: we must call removeHiddenUrls before insertMarkdownLinks because the latter will insert markdown links
        val = S.util.removeHiddenUrls(val);
        val = this.insertMarkdownLinks(urls, val);
        return val;
    }

    insertMarkdownLinks(urls: Map<string, UrlInfo>, val: string): string {
        if (!urls || !val) return val;
        urls.forEach((ui: UrlInfo) => {
            if (val.indexOf("(" + ui.url) == -1) {
                val = val.replaceAll(ui.url, `[${ui.url}](${ui.url})`);
            }
        });
        return val;
    }

    translateLaTex(val: string): string {
        if (!val) return val;
        // val = val.replaceAll(" $", " \\$"); // this thing will be the death of me.
        if (val.indexOf("\\") == -1) return val;

        return val.replaceAll("\\(", "$")//
            .replaceAll("\\)", "$")//
            .replaceAll("\\[", "$$")//
            .replaceAll("\\]", "$$");
    }

    override preRender(): boolean | null {
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

    override compRender(_children: CompT[]): ReactNode {
        const state = this.getState<LS>();

        // ReactMarkdown can't have this 'ref' and would throw a warning if we did
        delete this.attribs.ref;

        // Process with special markdown if there is any.
        const sections = this.processSpecialMarkdown(state.content);
        if (sections) {
            return sections;
        }
        return createElement(ReactMarkdownComp as any, this.attribs, state.content);
    }

    /* When any markdown content contains something like "-**My Section Title**-" that will be
        rendered as a collapsible section where everything below the section title, up to a double
        blank line, will be hidden until the user clicks the section title to expand it. 
    */
    processSpecialMarkdown(content: string) {
        let hasCollapse = false;
        if (content.indexOf(NodeCompMarkdown.COLLAPSE_TITLE_START) != -1 && //
            content.indexOf(NodeCompMarkdown.COLLAPSE_TITLE_END) != -1) {
            hasCollapse = true;
        }

        let hasCentering = false;
        if (content.indexOf(NodeCompMarkdown.CENTERING_START) != -1 && //
            content.indexOf(NodeCompMarkdown.CENTERING_END) != -1) {
            hasCentering = true;
        }

        if (!hasCollapse && !hasCentering) return null;

        content = content || "";
        content = content.replaceAll("\r", "");
        const lines = content.split("\n");
        let inCollapse: boolean = false;
        let blankLines = 0;
        const children: ReactNode[] = [];
        let curBuf = "";
        let collapseTitle: string = null;
        let inGatedSection = false;

        lines?.forEach((line, i) => {
            if (line.startsWith("```") && !inGatedSection) {
                inGatedSection = true;
            }
            else if (line.startsWith("```") && inGatedSection) {
                inGatedSection = false;
            }

            if (line == "-") {
                if (curBuf) {
                    this.attribs.key = "ncmkd_" + this.node.id + "_" + i;
                    children.push(createElement(ReactMarkdownComp as any, this.attribs, curBuf));
                    curBuf = "";
                }
                children.push(createElement("br"));
                return;
            }
            else if (!inGatedSection && line.startsWith(NodeCompMarkdown.CENTERING_START) && //
                line.endsWith(NodeCompMarkdown.CENTERING_END)) {
                const centeredText = line.substring(2, line.length - 2).trim();
                children.push(createElement(ReactMarkdownComp as any, { className: "centeredText" }, centeredText));
                return;
            }
            else if (!inGatedSection && line.startsWith(NodeCompMarkdown.COLLAPSE_TITLE_START) && //
                line.endsWith(NodeCompMarkdown.COLLAPSE_TITLE_END)) {
                // if we ran into another collapsible before the last one ended, end it now. It
                // should've ended with two blank lines but that's ok, we can end it anyway.
                if (inCollapse && curBuf) {
                    this.addCollapsible(children, curBuf, collapseTitle, "_" + i);
                    curBuf = "";
                }

                collapseTitle = line.substring(3, line.length - 3);
                if (curBuf) {
                    this.attribs.key = "ncmkd_" + this.node.id + "_" + i;
                    children.push(createElement(ReactMarkdownComp as any, this.attribs, curBuf));
                    curBuf = "";
                }
                inCollapse = true;
                blankLines = 0;
                return;
            }
            curBuf += line + "\n";

            if (line.trim().length == 0) {
                blankLines++;
                if (inCollapse && blankLines == 2 && curBuf) {
                    inCollapse = false;
                    this.addCollapsible(children, curBuf, collapseTitle, "_" + i);
                    curBuf = "";
                    collapseTitle = null;
                    blankLines = 0;
                }
            }
            else {
                blankLines = 0;
            }
        });

        if (children.length > 0 || inCollapse) {
            if (curBuf) {
                if (inCollapse) {
                    this.addCollapsible(children, curBuf, collapseTitle, "f");
                }
                else {
                    this.attribs.key = "ncmkd_" + this.node.id + "_f";
                    children.push(createElement(ReactMarkdownComp as any, this.attribs, curBuf));
                }
            }
            return children;
        }
        return null;
    }

    addCollapsible(children: ReactNode[], curBuf: string, collapseTitle: string, suffix: string) {
        const key = this.node.id + "_" + collapseTitle;
        const expanded = (getAs().expandedCollapsibles.has(key));

        children.push(createElement("div", {
            onClick: () => {
                dispatch("toggleCollapsibleMarkdown", s => {
                    if (s.expandedCollapsibles.has(key)) {
                        s.expandedCollapsibles.delete(key);
                    }
                    else {
                        s.expandedCollapsibles.add(key);
                    }
                });
            },
            className: expanded ? "collapsibleMarkdownExpanded iconUp" : "collapsibleMarkdown iconDown",
            title: expanded ? "Click to Collapse" : "Click to Expand"
        }, collapseTitle));
        this.attribs.key = "ncmkd_" + this.node.id + "_" + suffix;

        if (expanded) {
            const attribs = { ...this.attribs };
            attribs.className = attribs.className + " expandedCollapsible";
            children.push(createElement(ReactMarkdownComp as any, attribs, curBuf));
        }
    }

    async decrypt() {
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
