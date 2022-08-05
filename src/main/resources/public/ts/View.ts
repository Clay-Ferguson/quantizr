import { dispatch, getAppState } from "./AppRedux";
import { AppState } from "./AppState";
import { LeftNavPanel } from "./comp/LeftNavPanel";
import { RightNavPanel } from "./comp/RightNavPanel";
import { Constants as C } from "./Constants";
import { NodeStatsDlg } from "./dlg/NodeStatsDlg";
import * as J from "./JavaIntf";
import { PubSub } from "./PubSub";
import { S } from "./Singletons";

// This is magically defined in webpack.common.js;
declare var BUILDTIME: string;
declare var PROFILE: string;

export class View {
    docElm: any = (document.documentElement || document.body.parentNode || document.body);

    jumpToId = (id: string, forceRenderParent: boolean = false) => {
        // console.log("jumpToId: " + id);
        const state = getAppState();
        if (C.DEBUG_SCROLLING) {
            console.log("view.jumpToId");
        }
        this.refreshTree({
            nodeId: id,
            zeroOffset: true,
            renderParentIfLeaf: true,
            highlightId: id,
            forceIPFSRefresh: false,
            scrollToTop: false,
            allowScroll: true,
            setTab: true,
            forceRenderParent,
            state
        });
    }

    /*
     * newId is optional and if specified makes the page scroll to and highlight that node upon re-rendering.
     */
    refreshTree = async (a: RefreshTreeArgs) => {

        // let childCount = state.node && state.node.children ? state.node.children.length : 0;
        // console.log("refreshTree with ID=" + nodeId + " childrenCount=" + childCount);
        if (!a.nodeId && a.state.node) {
            a.nodeId = a.state.node.id;
        }

        if (!a.highlightId) {
            const currentSelNode = S.nodeUtil.getHighlightedNode(a.state);
            a.highlightId = currentSelNode ? currentSelNode.id : a.nodeId;
        }

        let offset = 0;
        if (!a.zeroOffset) {
            const firstChild = S.edit.getFirstChildNode(a.state);
            offset = firstChild ? firstChild.logicalOrdinal : 0;
        }

        // console.log("refreshTree: nodeId=" + nodeId);

        /* named nodes aren't persisting in url without this and i may decide to just get rid
         of 'renderParentIfLeaf' altogether (todo-2) but for now i'm just fixing the case when we are
         rendering a named node. */
        if (a.nodeId.indexOf(":") !== -1) {
            a.renderParentIfLeaf = false;
        }

        try {
            const res = await S.util.ajax<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
                nodeId: a.nodeId,
                upLevel: false,
                siblingOffset: 0,
                renderParentIfLeaf: a.renderParentIfLeaf,
                forceRenderParent: a.forceRenderParent,
                offset,
                goToLastPage: false,
                forceIPFSRefresh: a.forceIPFSRefresh,
                singleNode: false,
                parentCount: a.state.userPrefs.showParents ? 1 : 0
            });
            if (!res.node) return;
            if (C.DEBUG_SCROLLING) {
                console.log("refreshTree -> renderPage (scrollTop=" + a.scrollToTop + ")");
            }
            S.render.renderPage(res, a.scrollToTop, a.highlightId, a.setTab, a.allowScroll);
        }
        catch (e) {
            S.nodeUtil.clearLastNodeIds();
            // S.nav.navHome(state);
        }
    }

    firstPage = (state: AppState) => {
        this.loadPage(false, 0, false, state);
    }

    prevPage = (state: AppState) => {
        const firstChildNode = S.edit.getFirstChildNode(state);
        if (firstChildNode && firstChildNode.logicalOrdinal > 0) {
            let targetOffset = firstChildNode.logicalOrdinal - J.ConstantInt.ROWS_PER_PAGE;
            if (targetOffset < 0) {
                targetOffset = 0;
            }

            this.loadPage(false, targetOffset, false, state);
        }
    }

    nextPage = (state: AppState) => {
        const lastChildNode = S.edit.getLastChildNode(state);
        if (lastChildNode) {
            const targetOffset = lastChildNode.logicalOrdinal + 1;
            this.loadPage(false, targetOffset, false, state);
        }
    }

    lastPage = (state: AppState) => {
        // console.log("Running lastPage Query");
        // nav.mainOffset += J.ConstantInt.ROWS_PER_PAGE;
        // this.loadPage(true, targetOffset, state);
    }

    /* As part of 'infinite scrolling', this gets called when the user scrolls to the end of a page and we
    need to load more records automatically, and add to existing page records */
    growPage = (state: AppState) => {
        // console.log("growPage");
        const lastChildNode = S.edit.getLastChildNode(state);
        if (lastChildNode) {
            const targetOffset = lastChildNode.logicalOrdinal + 1;
            this.loadPage(false, targetOffset, true, state);
        }
    }

    /* Note: if growingPage==true we preserve the existing row data, and append more rows onto the current view */
    private loadPage = async (goToLastPage: boolean, offset: number, growingPage: boolean, state: AppState) => {
        console.log("loadPage nodeId=" + state.node.id);

        try {
            const res = await S.util.ajax<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
                nodeId: state.node.id,
                upLevel: false,
                siblingOffset: 0,
                renderParentIfLeaf: true,
                forceRenderParent: false,
                offset,
                goToLastPage,
                forceIPFSRefresh: false,
                singleNode: false,
                parentCount: state.userPrefs.showParents ? 1 : 0
            });

            if (!res.node) return;

            // if this is an "infinite scroll" call to load in additional nodes
            if (growingPage) {
                let scrollToTop = true;

                /* if the response has some children, and we already have local children we can add to, and we haven't reached
                max dynamic rows yet, then make our children equal the concatenation of existing rows plus new rows */
                if (res?.node?.children && state?.node?.children && state.node.children.length < C.MAX_DYNAMIC_ROWS) {
                    // create a set for duplicate detection
                    const idSet: Set<string> = new Set<string>();

                    // load set for known children.
                    state.node.children.forEach(child => {
                        idSet.add(child.id);
                    });

                    // assign 'res.node.chidren' as the new list appending in the new ones with dupliates removed.
                    res.node.children = state.node.children.concat(res.node.children.filter(child => !idSet.has(child.id)));
                    scrollToTop = false;
                }

                if (C.DEBUG_SCROLLING) {
                    console.log("loadPage -> renderPage (scrollTop=" + scrollToTop + ")");
                }
                S.render.renderPage(res, scrollToTop, null, false, scrollToTop);
            }
            // else, loading in a page which overrides and discards all existing nodes in browser view
            else {
                if (C.DEBUG_SCROLLING) {
                    console.log("loadPage(3) -> renderPage (scrollTop=true)");
                }
                S.render.renderPage(res, true, null, true, true);
            }
        }
        catch (e) {
            S.nodeUtil.clearLastNodeIds();
            // S.nav.navHome(state);
        }
    }

    // NOTE: Method not still being used. Let's keep it for future reference
    // scrollRelativeToNode = (dir: string, state: AppState) => {
    //     const currentSelNode: J.NodeInfo = S.nodeUtil.getHighlightedNode(state);
    //     if (!currentSelNode) return;

    //     let newNode: J.NodeInfo = null;

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

    //         state.node.children.some((child: J.NodeInfo) => {
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
    //             return s;
    //         });
    //     }
    // }

    scrollAllTop = (state: AppState) => {
        if (C.DEBUG_SCROLLING) {
            console.log("scrollAllTop");
        }
        const activeTabComp = S.tabUtil.getActiveTabComp(state);
        if (activeTabComp && activeTabComp.getRef()) {
            activeTabComp.setScrollTop(0);
            // console.log("Scrolled comp to top: " + activeTabComp.getRef().id);
        }

        // todo-1: For some reason in mobile mode we're scrolling lots of times TO the element even when it's the top
        // element and we want to scroll to ZERO instead, but I can't get that to work and i'm giving up the 
        // battle for now after 2 hrs trying to locate the issue. Existing functionality is not what I really
        // want but is still fine.
        // S.domUtil.getElm(C.ID_TAB, (elm: HTMLElement) => {
        //     elm.scrollTop = 0;
        // });        

        else {
            LeftNavPanel.inst?.setScrollTop(0);
            RightNavPanel.inst?.setScrollTop(0);
        }
    }

    scrollToNode = (state: AppState, node: J.NodeInfo = null) => {
        // S.quanta.setOverlay(true);

        const func = () => {
            //    try {
            /* Check to see if we are rendering the top node (page root), and if so
            it is better looking to just scroll to zero index, because that will always
            be what user wants to see */
            node = node || S.nodeUtil.getHighlightedNode(state);

            /* the scrolling got slightly convoluted, so I invented 'editNodeId' just to be able to detect
             a case where the user is editing a node and we KNOW we don't need to scroll after editing,
             so this is where we detect and reset that scenario. */
            if (node?.id === S.quanta.noScrollToId) {
                // console.log("noScrollToId flag");
                return;
            }

            if (state.node.id === node?.id) {
                // console.log("is root, scroll to top");
                this.scrollAllTop(state);
                return;
            }

            if (C.DEBUG_SCROLLING) {
                console.log("ScrollToNode: id=" + node?.id)
            }

            let elm: any = null;
            if (node) {
                // console.log("looking up using element id: " + nodeId);
                elm = S.domUtil.domElm(S.nav._UID_ROWID_PREFIX + node.id);
            }

            elm = elm || S.nav.getSelectedDomElement(state);
            if (elm) {
                if (elm.firstElementChild) {
                    // console.log("Got first element: " + elm.firstElementChild);
                    elm = elm.firstElementChild;
                }

                if (C.DEBUG_SCROLLING) {
                    console.log("scrollIntoView elm: " + elm.id);
                }
                elm.scrollIntoView(true);
            }
            else {
                if (C.DEBUG_SCROLLING) {
                    console.log("getSelectedDomElement was null. Scroll top now.")
                }
                this.scrollAllTop(state);
            }
        };

        //     } finally {
        //         setTimeout(() => {
        //             S.quanta.setOverlay(false);
        //         }, 100);
        //     }
        // }, 100);

        PubSub.subSingleOnce(C.PUBSUB_mainWindowScroll, () => {
            // console.log("execute: C.PUBSUB_mainRenderComplete: run scrollToNode");
            func();
        });
    }

    scrollToTop = async () => {
        PubSub.subSingleOnce(C.PUBSUB_mainWindowScroll, () => {
            this.scrollAllTop(getAppState());
        });
    }

    getNodeStats = async (state: AppState, trending: boolean, feed: boolean): Promise<any> => {
        const node = S.nodeUtil.getHighlightedNode(state);
        const res = await S.util.ajax<J.GetNodeStatsRequest, J.GetNodeStatsResponse>("getNodeStats", {
            nodeId: node ? node.id : null,
            trending,
            feed,
            getWords: true,
            getTags: true,
            getMentions: true
        });
        new NodeStatsDlg(res, trending, feed).open();
    }

    runServerCommand = async (command: string, parameter: string, dlgTitle: string, dlgDescription: string, state: AppState) => {
        const node = S.nodeUtil.getHighlightedNode(state);

        const res = await S.util.ajax<J.GetServerInfoRequest, J.GetServerInfoResponse>("getServerInfo", {
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
                    m.message += "Profile: " + PROFILE + "\n";
                }

                /* For now just prefix description onto the text. This will be made 'prettier' later todo-2 */
                if (dlgDescription) {
                    m.message = dlgDescription + "\n\n" + m.message;
                }

                dispatch("showServerInfo", s => {
                    S.tabUtil.tabChanging(s.activeTab, C.TAB_SERVERINFO, s);
                    s.activeTab = S.quanta.activeTab = C.TAB_SERVERINFO;
                    s.serverInfoText = m.message;
                    s.serverInfoCommand = command;
                    s.serverInfoTitle = dlgTitle;
                    return s;
                });
            });
        }
    }
}

interface RefreshTreeArgs {
    nodeId: string;
    zeroOffset: boolean;
    renderParentIfLeaf: boolean;
    highlightId: string;
    forceIPFSRefresh: boolean;
    scrollToTop: boolean;
    allowScroll: boolean;
    setTab: boolean;
    forceRenderParent: boolean;
    state: AppState
}
