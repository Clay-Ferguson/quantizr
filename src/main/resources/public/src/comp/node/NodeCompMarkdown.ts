import { ReactNode, createElement } from "react";
import { dispatch, getAs } from "../../AppContext";
import * as J from "../../JavaIntf";
import { S } from "../../Singletons";
import { TabBase } from "../../intf/TabBase";
import { Comp, CompT } from "../base/Comp";
import ReactMarkdownComp from "../core/ReactMarkdownComp";
import { NodeInfo } from "../../JavaIntf";
import { UrlInfo } from "../../plugins/base/TypeBase";
import QuickLRU from 'quick-lru';

const cache = new QuickLRU({ maxSize: 1000 });

interface LS {
    content: string;
}

export class NodeCompMarkdown extends Comp {
    // detects URLs in a string (from Stack Overflow, not fully vetted yet)
    static urlRegex = /(https?:\/\/[^\s]+)/g;
    static COLLAPSE_TITLE_START = "-**";
    static COLLAPSE_TITLE_END = "**-";
    static CENTERING_START = "->";
    static CENTERING_END = "<-";
    static CENTERING_START2 = "-&gt;";
    static CENTERING_END2 = "&lt;-";

    // I had this named 'content' but it confused TypeScript and interfered with the Html constructor,
    // but is ok named as 'cont'
    cont: string;

    constructor(public node: NodeInfo, extraContainerClass: string, _tabData: TabBase<any>, private urls: Map<string, UrlInfo>) {
        super({ key: "ncmkd_" + node.id });
        this.cont = node.renderContent || node.content;
        this.attribs.nodeId = node.id; // this 'nodeId' is needed to track expand collapse of code blocks.
        this.attribs.className = "mkCont";

        if (extraContainerClass) {
            this.attribs.className += " " + extraContainerClass;
        }

        this.mergeState<LS>({
            content: this.cont || ""
        });
    }

    /* If content is passed in it will be used. It will only be passed in when the node is encrypted and the text
    has been decrypted and needs to be rendered, in which case we don't need the node.content, but use the 'content' parameter here */
    preprocessMarkdown(node: NodeInfo, urls: Map<string, UrlInfo>): string {
        const content = this.cont || "";
        let val = S.render.injectSubstitutions(node, content);

        if (S.props.isMine(node)) {
            val = S.util.makeHtmlCommentsVisible(val);
        }

        // NOTE: we must call removeHiddenUrls before insertMarkdownLinks because the latter will insert markdown links
        val = S.util.processLines(val);
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

    override compRender(_children: CompT[]): ReactNode {
        const state = this.getState<LS>();

        // ReactMarkdown can't have this 'ref' and would throw a warning if we did
        delete this.attribs.ref;

        if (state.content?.indexOf(J.Constant.ENC_TAG) === 0) {
            return createElement(ReactMarkdownComp as any, this.attribs, "[Encrypted]");
        }

        const key = this.attribs.key + "_" + state.content;
        let ret: any = cache.get(key);
        if (ret) {
            return cache.get(key) as ReactNode;
        }

        const content = this.preprocessMarkdown(this.node, this.urls);
        // Process with special markdown if there is any.
        ret = this.processSpecialMarkdown(content);
        if (!ret) {
            ret = createElement(ReactMarkdownComp as any, this.attribs, content);
        }
        cache.set(key, ret);
        return ret;
    }

    /* When any markdown content contains something like "-**My Section Title**-" that will be
        rendered as a collapsible section where everything below the section title, up to a double
        blank line, will be hidden until the user clicks the section title to expand it. 
    */
    processSpecialMarkdown(content: string) {
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
            else if (!inGatedSection && line.startsWith(NodeCompMarkdown.CENTERING_START2) && //
                line.endsWith(NodeCompMarkdown.CENTERING_END2)) {
                const centeredText = line.substring(5, line.length - 5).trim();
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
}
