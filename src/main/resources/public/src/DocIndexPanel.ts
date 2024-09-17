import { getAs, promiseDispatch } from "./AppContext";
import { Constants as C } from "./Constants";
import { DocumentRSInfo } from "./DocumentRSInfo";
import * as J from "./JavaIntf";
import { NodeInfo } from "./JavaIntf";
import { S } from "./Singletons";
import { Div } from "./comp/core/Div";
import { Html } from "./comp/core/Html";
import { TabBase } from "./intf/TabBase";

export class DocIndexPanel extends Div {
    static initialized: boolean = false;

    constructor() {
        super();
        this.attribs.className = "docIndexPanel";
    }

    override preRender(): boolean | null {
        const data: TabBase = S.tabUtil.getAppTabData(C.TAB_DOCUMENT);
        if (!data || !data.props) return false;
        const info = data.props as DocumentRSInfo;
        if (!info.results || info.results.length < 2) return false;
        const ast = getAs();

        let index = "";
        let count = 0;
        const baseSlashCount = S.util.countChars(info.results[0].path, "/");

        // Since we can have a large number of items we use a single HTML string for performance.
        // This is a very special case and is not a pattern to be followed in general.
        for (const node of info.results) {
            if (node.hasChildren) {
                const level = S.util.countChars(node.path, "/") - baseSlashCount;
                const clazz = ast.indexHighlightNode == node.id ? "docIdxLnkHighlight" : "docIdxLnk";
                index += `<div style="margin-left: ${level * 12}px" class="${clazz}" ${C.NODE_ID_ATTR}="${node.id}">${this.getLevelBullet(level)}&nbsp;${this.getShortContent(node)}</div>`;
                count++;
            }
        }
        if (count < 2) return false;

        const html = new Html(index, null,
            // click function to jump to node that's clicked on
            (evt: Event) => {
                const nodeId = S.domUtil.getNodeIdFromDom(evt);
                if (nodeId) {
                    this.clickItem(nodeId);
                }
            });

        this.children = [html];
        return true;
    }

    // This click function opens up the document tab and scrolls to the node that was clicked on
    async clickItem(id: string) {
        const data: TabBase = S.tabUtil.getAppTabData(C.TAB_DOCUMENT);
        if (!data || !data.props) return false;
        const info = data.props as DocumentRSInfo;
        if (!info.results) return false;
        let curPage = 0;
        let idx = 0;
        for (const node of info.results) {
            if (node.id === id) {
                curPage = Math.floor(idx / J.ConstantInt.DOC_ITEMS_PER_PAGE);
                await promiseDispatch("docPage", s => {
                    info.page = curPage;
                    s.activeTab = C.TAB_DOCUMENT;
                    s.indexHighlightNode = id;
                });
                setTimeout(() => {
                    data.inst.scrollToNode(id);
                }, 10);
                break;
            }
            idx++;
        }
    }

    getLevelBullet(level: number) {
        switch (level) {
            case 1: return "&#9688;";
            case 2: return "&#8227;";
            case 3: return "&#8226;";
            case 4: return "&#9702;";
        }
        return "";
    }

    getShortContent(node: NodeInfo) {
        let content = node.content;
        const idx = content.indexOf("\n");
        if (idx !== -1) {
            content = content.substring(0, idx);
        }
        content = S.util.trimLeadingChars(content, "#");

        if (content.length > 80) content = content.substring(0, 80) + "...";
        return S.domUtil.escapeHtml(content).trim();
    }
}
