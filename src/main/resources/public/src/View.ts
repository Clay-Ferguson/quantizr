import { dispatch, getAs } from "./AppContext";
import { Comp } from "./comp/base/Comp";
import { Constants as C } from "./Constants";
import { FullScreenType } from "./Interfaces";
import { TabBase } from "./intf/TabBase";
import * as J from "./JavaIntf";
import { NodeInfo } from "./JavaIntf";
import { PubSub } from "./PubSub";
import { S } from "./Singletons";

declare const BUILDTIME: string;

export class View {
    docElm: any = (document.documentElement || document.body.parentNode || document.body);

    async searchUnderId(id: string, text: string) {
        await S.srch.search(id, null, text, null, "Content: " + text,
            null,
            false,
            false, // case sens 
            0,
            true, // recursive
            "mtm", // sort field
            "desc", // sort dir
            false,
            false,
            false,
            false,
            false);
    }

    async bookmarkClick(bookmark: J.Bookmark) {
        const id = bookmark.id || bookmark.selfId;
        if (bookmark.search) {
            await this.searchUnderId(id, bookmark.search);
        }
        else {
            await this.jumpToId(id);
        }
    }

    async jumpToId(id: string, forceRenderParent: boolean = false) {
        if (C.DEBUG_SCROLLING) {
            console.log("view.jumpToId");
        }
        await this.refreshTree({
            nodeId: id,
            zeroOffset: true,
            highlightId: id,
            scrollToTop: false,
            allowScroll: true,
            setTab: true,
            forceRenderParent,
            jumpToRss: false
        });
    }

    /*
     * newId is optional and if specified makes the page scroll to and highlight that node upon re-rendering.
     */
    async refreshTree(a: RefreshTreeArgs) {
        const ast = getAs();
        if (!a.nodeId && ast.node) {
            a.nodeId = ast.node.id;
        }

        if (!a.highlightId) {
            const currentSelNode = S.nodeUtil.getHighlightedNode();
            a.highlightId = currentSelNode ? currentSelNode.id : a.nodeId;
        }

        let offset = 0;
        if (!a.zeroOffset) {
            const firstChild = S.edit.getFirstChildNode();
            offset = firstChild ? firstChild.logicalOrdinal : 0;
        }

        const res = await S.rpcUtil.rpc<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
            nodeId: a.nodeId,
            upLevel: false,
            siblingOffset: 0,
            forceRenderParent: a.forceRenderParent,
            offset,
            goToLastPage: false,
            singleNode: false,
            jumpToRss: a.jumpToRss
        });
        S.nodeUtil.processInboundNode(res.node);

        // if jumpToRss that means we don't want to display the node, but jump straight to the RSS
        // Tab and display the actual RSS feed that this node defines.
        if (a.jumpToRss && res?.rssNode) {
            dispatch("LoadingFeed", s => {
                s.savedActiveTab = s.activeTab;
                s.fullScreenConfig = { type: FullScreenType.NONE };
                s.rssNode = res.node;
                s.activeTab = C.TAB_RSS;
                S.domUtil.focusId(C.TAB_RSS);
                S.tabUtil.tabScroll(C.TAB_RSS, 0);
            });
            return;
        }

        if (!res || res.code != C.RESPONSE_CODE_OK) {
            console.log("Unable to access node(4): " + a.nodeId + " RES: " + S.util.prettyPrint(res));
            return;
        }

        if (C.DEBUG_SCROLLING) {
            console.log("refreshTree -> renderPage (scrollTop=" + a.scrollToTop + ")");
        }
        await S.render.renderPage(res, a.scrollToTop, a.highlightId, a.setTab, a.allowScroll);
    }

    firstPage() {
        this.loadPage(false, 0, false);
    }

    prevPage() {
        const firstChild = S.edit.getFirstChildNode();
        if (firstChild?.logicalOrdinal > 0) {
            let targetOffset = firstChild.logicalOrdinal - J.ConstantInt.ROWS_PER_PAGE;
            if (targetOffset < 0) {
                targetOffset = 0;
            }

            this.loadPage(false, targetOffset, false);
        }
    }

    nextPage() {
        const lastChild = S.edit.getLastChildNode();
        if (lastChild) {
            const targetOffset = lastChild.logicalOrdinal + 1;
            this.loadPage(false, targetOffset, false);
        }
    }

    /* As part of 'infinite scrolling', this gets called when the user scrolls to the end of a page
    and we need to load more records automatically, and add to existing page records */
    growPage() {
        const lastChild = S.edit.getLastChildNode();
        if (lastChild) {
            const targetOffset = lastChild.logicalOrdinal + 1;
            this.loadPage(false, targetOffset, true);
        }
    }

    /* Note: if growingPage==true we preserve the existing row data, and append more rows onto the
    current view */
    private async loadPage(goToLastPage: boolean, offset: number, growingPage: boolean) {
        const ast = getAs();

        const res = await S.rpcUtil.rpc<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
            nodeId: ast.node.id,
            upLevel: false,
            siblingOffset: 0,
            forceRenderParent: false,
            offset,
            goToLastPage,
            singleNode: false,
            jumpToRss: false
        },
            // query as background mode if growing page
            growingPage);
        S.nodeUtil.processInboundNode(res.node);

        if (!res.node) return;

        // if this is an "infinite scroll" call to load in additional nodes
        if (growingPage) {
            /* if the response has some children, and we already have local children we can add to,
            and we haven't reached max dynamic rows yet, then make our children equal the
            concatenation of existing rows plus new rows */
            if (res?.node?.children && ast?.node?.children) {
                // create a set for duplicate detection
                const idSet: Set<string> = new Set<string>();

                // load set for known children.
                ast.node.children.forEach(child => idSet.add(child.id));

                // assign 'res.node.chidren' as the new list appending in the new ones with dupliates removed.
                res.node.children = ast.node.children.concat(res.node.children.filter(child => !idSet.has(child.id)));
            }
            S.render.renderPage(res, false, null, false, false);
        }
        // else, loading in a page which overrides and discards all existing nodes in browser view
        else {
            if (C.DEBUG_SCROLLING) {
                console.log("loadPage -> renderPage (scrollTop=true)");
            }
            S.render.renderPage(res, true, null, true, true);
        }
    }

    // NOTE: Method not still being used. Let's keep it for future reference
    // scrollRelativeToNode = (dir: string, ast : AppState) => {
    //     const currentSelNode: NodeInfo = S.nodeUtil.getHighlightedNode();
    //     if (!currentSelNode) return;

    //     let newNode: NodeInfo = null;

    //     // First detect if page root node is selected, before doing a child search
    //     if (currentSelNode.id === state.node.id) {
    //         // if going down that means first child node.
    //         if (dir === "down" && state.node.children?.length > 0) {
    //             newNode = state.node.children[0];
    //         }
    //         else if (dir === "up") {
    //             S.nav.navUpLevel(false);
    //         }
    //     }
    //     else if (state.node.children && state.node.children.length > 0) {
    //         let prevChild = null;
    //         let nodeFound = false;

    //         state.node.children.some((child: NodeInfo) => {
    //             let ret = false;

    //             if (nodeFound && dir === "down") {
    //                 ret = true;
    //                 newNode = child;
    //                 S.nodeUtil.highlightNode(child, true, state);
    //             }

    //             if (child.id === currentSelNode.id) {
    //                 if (dir === "up") {
    //                     if (prevChild) {
    //                         ret = true;
    //                         newNode = prevChild;
    //                     }
    //                     else {
    //                         newNode = state.node;
    //                     }
    //                 }
    //                 nodeFound = true;
    //             }
    //             prevChild = child;
    //             return ret; // NOTE: returning true stops the iteration.
    //         });
    //     }
    //     if (newNode) {
    //         dispatch("HighlightAndScrollToNode", s => {
    //             S.nodeUtil.highlightNode(newNode, true, s);
    //         });
    //     }
    // }

    scrollActiveToTop() {
        if (C.DEBUG_SCROLLING) {
            console.log("scrollAllTop");
        }
        const activeTabComp = S.tabUtil.getActiveTabComp();
        if (activeTabComp?.getRef()) {
            activeTabComp.setScrollTop(0);
        }
    }

    scrollToNode(node: NodeInfo = null, delay: number = 100) {
        if (!Comp.allowScrollSets || !node) return;

        const func = () => {
            setTimeout(() => {
                /* Check to see if we are rendering the top node (page root), and if so
                it is better looking to just scroll to zero index, because that will always
                be what user wants to see */
                node = node || S.nodeUtil.getHighlightedNode();

                /* the scrolling got slightly convoluted, so I invented 'editNodeId' just to be able
                 to detect a case where the user is editing a node and we KNOW we don't need to
                 scroll after editing, so this is where we detect and reset that scenario. */
                if (!node || node.id === S.quanta.noScrollToId) {
                    return;
                }

                if (getAs().node.id === node.id) {
                    this.scrollActiveToTop();
                    return;
                }

                const elm = S.domUtil.domElm(C.TAB_MAIN + node.id);
                if (elm) {
                    // ---------------------------
                    // scrollIntoView works, but is off a bit because we have a 'sticky' header covering up
                    // part of the window making scrollIntoView appear not to work.
                    // elm.scrollIntoView(true);
                    // ---------------------------
                    const data: TabBase = S.tabUtil.getAppTabData(C.TAB_MAIN);
                    if (data) {
                        data.inst.scrollToElm(elm);
                    }
                }
            }, delay);
        };

        PubSub.subSingleOnce(C.PUBSUB_mainWindowScroll, () => {
            func();
        });
    }

    async scrollToTop() {
        PubSub.subSingleOnce(C.PUBSUB_mainWindowScroll, () => {
            this.scrollActiveToTop();
        });
    }

    async getNodeStats(): Promise<any> {
        const node = S.nodeUtil.getHighlightedNode();
        const res = await S.rpcUtil.rpc<J.GetNodeStatsRequest, J.GetNodeStatsResponse>("getNodeStats", {
            nodeId: node.id,
            getWords: true,
            getTags: true,
            signatureVerify: false
        });

        dispatch("showNodeStats", s => {
            // lookup data for TAB_STATS and set the data with res
            const data: TabBase = S.tabUtil.getAppTabData(C.TAB_STATS);
            data.props.res = res;

            S.tabUtil.tabChanging(s.activeTab, C.TAB_STATS);
            s.activeTab = C.TAB_STATS;
            s.statsNodeId = node.id;
        });
    }

    async signSubGraph(signUnsigned: boolean): Promise<any> {
        if (!S.crypto.sigKeyOk()) {
            return null;
        }
        const node = S.nodeUtil.getHighlightedNode();
        await S.rpcUtil.rpc<J.SignSubGraphRequest, J.SignSubGraphResponse>("signSubGraph", {
            nodeId: node ? node.id : null,
            signUnsigned
        });
        S.util.showMessage("Signature generation initiated. Leave this browser window open until notified signatures are complete.", "Signatures");
    }

    async getNodeSignatureVerify(): Promise<any> {
        const node = S.nodeUtil.getHighlightedNode();
        const res = await S.rpcUtil.rpc<J.GetNodeStatsRequest, J.GetNodeStatsResponse>("getNodeStats", {
            nodeId: node ? node.id : null,
            getWords: false,
            getTags: false,
            signatureVerify: true
        });

        dispatch("showNodeStats", s => {
            const data: TabBase = S.tabUtil.getAppTabData(C.TAB_STATS);
            data.props.res = res;
            S.tabUtil.tabChanging(s.activeTab, C.TAB_STATS);
            s.activeTab = C.TAB_STATS;
            s.statsNodeId = node.id;
        });
    }

    _removeSignatures = async (): Promise<any> => {
        const node = S.nodeUtil.getHighlightedNode();
        const res = await S.rpcUtil.rpc<J.RemoveSignaturesRequest, J.RemoveSignaturesResponse>("removeSignatures", {
            nodeId: node ? node.id : null
        });

        if (res) {
            S.quanta.refresh();
            setTimeout(() => {
                S.util.showMessage("Finished Removing Signatures", "Signatures");
            }, 1000);
        }
    }

    async runServerCommand(command: string, parameter: string, dlgTitle: string, dlgDescription: string) {
        const node = S.nodeUtil.getHighlightedNode();

        const res = await S.rpcUtil.rpc<J.GetServerInfoRequest, J.GetServerInfoResponse>("getServerInfo", {
            command,
            parameter,
            nodeId: node ? node.id : null
        });

        if (res.messages) {
            res.messages.forEach(m => {
                /* a bit confusing here but this command is the same as the name of the AJAX call above (getServerInfo), but
              there are other commands that exist also */
                if (command === "getServerInfo") {
                    m.message += "\nBrowser Memory: " + S.util.getBrowserMemoryInfo() + "\n";
                    m.message += "Build Time: " + BUILDTIME + "\n";
                }

                if (dlgDescription) {
                    m.message = dlgDescription + "\n\n" + m.message;
                }

                dispatch("showServerInfo", s => {
                    S.tabUtil.tabChanging(s.activeTab, C.TAB_SERVERINFO);
                    s.activeTab = C.TAB_SERVERINFO;
                    s.serverInfoText = m.message;
                    s.serverInfoCommand = command;
                    s.serverInfoTitle = dlgTitle;
                });
            });
        }
    }
}

interface RefreshTreeArgs {
    nodeId: string;
    zeroOffset: boolean;
    highlightId: string;
    scrollToTop: boolean;
    allowScroll: boolean;
    setTab: boolean;
    forceRenderParent: boolean;
    jumpToRss: boolean;
}
