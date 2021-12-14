import { dispatch, store } from "./AppRedux";
import { AppState } from "./AppState";
import { Constants as C } from "./Constants";
import { NodeStatsDlg } from "./dlg/NodeStatsDlg";
import * as J from "./JavaIntf";
import { PubSub } from "./PubSub";
import { S } from "./Singletons";

// This is magically defined in webpack.common.js;
declare var BUILDTIME;
declare var PROFILE;

export class View {

    docElm: any = (document.documentElement || document.body.parentNode || document.body);

    jumpToId = (id: string, forceRenderParent: boolean = false): void => {
        // console.log("jumpToId: " + id);
        let state = store.getState();
        if (C.DEBUG_SCROLLING) {
            console.log("view.jumpToId");
        }
        this.refreshTree(id, true, true, id, false, false, true, true, forceRenderParent, state);
    }

    /*
     * newId is optional and if specified makes the page scroll to and highlight that node upon re-rendering.
     */
    refreshTree = async (nodeId: string, zeroOffset: boolean, renderParentIfLeaf: boolean, highlightId: string, forceIPFSRefresh: boolean,
        scrollToTop: boolean, allowScroll: boolean, setTab: boolean, forceRenderParent: boolean, state: AppState): Promise<void> => {

        // let childCount = state.node && state.node.children ? state.node.children.length : 0;
        // console.log("refreshTree with ID=" + nodeId + " childrenCount=" + childCount);
        if (!nodeId && state.node) {
            nodeId = state.node.id;
        }

        if (!highlightId) {
            const currentSelNode: J.NodeInfo = S.nodeUtil.getHighlightedNode(state);
            highlightId = currentSelNode ? currentSelNode.id : nodeId;
        }

        let offset = 0;
        if (!zeroOffset) {
            let firstChild: J.NodeInfo = S.edit.getFirstChildNode(state);
            offset = firstChild ? firstChild.logicalOrdinal : 0;
        }

        // console.log("refreshTree: nodeId=" + nodeId);

        /* named nodes aren't persisting in url without this and i may decide to just get rid
         of 'renderParentIfLeaf' altogether (todo-1) but for now i'm just fixing the case when we are
         rendering a named node. */
        if (nodeId.indexOf(":") !== -1) {
            renderParentIfLeaf = false;
        }

        try {
            let res: J.RenderNodeResponse = await S.util.ajax<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
                nodeId,
                upLevel: false,
                siblingOffset: 0,
                renderParentIfLeaf,
                forceRenderParent,
                offset,
                goToLastPage: false,
                forceIPFSRefresh,
                singleNode: false
            });
            if (C.DEBUG_SCROLLING) {
                console.log("refreshTree -> renderPageFromData (scrollTop=" + scrollToTop + ")");
            }
            S.render.renderPageFromData(res, scrollToTop, highlightId, setTab, allowScroll);
        }
        catch (e) {
            S.nodeUtil.clearLastNodeIds();
            S.nav.navHome(state);
        }
    }

    firstPage = (state: AppState): void => {
        this.loadPage(false, 0, false, state);
    }

    prevPage = (state: AppState): void => {
        let firstChildNode: J.NodeInfo = S.edit.getFirstChildNode(state);
        if (firstChildNode && firstChildNode.logicalOrdinal > 0) {
            let targetOffset = firstChildNode.logicalOrdinal - J.ConstantInt.ROWS_PER_PAGE;
            if (targetOffset < 0) {
                targetOffset = 0;
            }

            this.loadPage(false, targetOffset, false, state);
        }
    }

    nextPage = (state: AppState): void => {
        let lastChildNode: J.NodeInfo = S.edit.getLastChildNode(state);
        if (lastChildNode) {
            let targetOffset = lastChildNode.logicalOrdinal + 1;
            this.loadPage(false, targetOffset, false, state);
        }
    }

    lastPage = (state: AppState): void => {
        // console.log("Running lastPage Query");
        // nav.mainOffset += J.ConstantInt.ROWS_PER_PAGE;
        // this.loadPage(true, targetOffset, state);
    }

    /* Part of 'infinite scrolling' this gets called when the user scrolls to the end of a page and we
    need to load more records automatically, and add to existing page records */
    growPage = (state: AppState): void => {
        let lastChildNode: J.NodeInfo = S.edit.getLastChildNode(state);
        if (lastChildNode) {
            let targetOffset = lastChildNode.logicalOrdinal + 1;
            this.loadPage(false, targetOffset, true, state);
        }
    }

    /* Note: if growingPage==true we preserve the existing row data, and append more rows onto the current view */
    private loadPage = async (goToLastPage: boolean, offset: number, growingPage: boolean, state: AppState): Promise<void> => {
        console.log("loadPage nodeId=" + state.node.id);

        try {
            let res: J.RenderNodeResponse = await S.util.ajax<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
                nodeId: state.node.id,
                upLevel: false,
                siblingOffset: 0,
                renderParentIfLeaf: true,
                forceRenderParent: false,
                offset,
                goToLastPage,
                forceIPFSRefresh: false,
                singleNode: false
            });

            // if this is an "infinite scroll" call to load in additional nodes
            if (growingPage) {
                let scrollToTop = true;

                /* if the response has some children, and we already have local children we can add to, and we haven't reached
                max dynamic rows yet, then make our children equal the concatenatio existing rows plus new rows */
                if (res?.node?.children && state?.node?.children && state.node.children.length < C.MAX_DYNAMIC_ROWS) {
                    // create a set for duplicate detection
                    let idSet: Set<string> = new Set<string>();

                    // load set for known children.
                    state.node.children.forEach(child => {
                        idSet.add(child.id);
                    });

                    // assign 'res.node.chidren' as the new list appending in the new ones with dupliates removed.
                    res.node.children = state.node.children.concat(res.node.children.filter(child => !idSet.has(child.id)));
                    scrollToTop = false;
                }

                if (scrollToTop) {
                    S.view.scrollAllTop(state);

                    // This is the currently untested final way to try to get the scroll to top to happen
                    // regarding the bug mentioned above this if block.
                    setTimeout(() => {
                        if (C.DEBUG_SCROLLING) {
                            console.log("loadPage(1) -> renderPageFromData (scrollTop=" + scrollToTop + ")");
                        }
                        S.render.renderPageFromData(res, scrollToTop, null, false, scrollToTop);
                    }, 1000);
                }
                else {
                    if (C.DEBUG_SCROLLING) {
                        console.log("loadPage(2) -> renderPageFromData (scrollTop=" + scrollToTop + ")");
                    }
                    S.render.renderPageFromData(res, scrollToTop, null, false, scrollToTop);
                }
            }
            // else, loading in a page which overrides and discards all existing nodes in browser view
            else {
                if (C.DEBUG_SCROLLING) {
                    console.log("loadPage(3) -> renderPageFromData (scrollTop=true)");
                }
                S.render.renderPageFromData(res, true, null, true, true);
            }
        }
        catch (e) {
            S.nodeUtil.clearLastNodeIds();
            S.nav.navHome(state);
        }
    }

    // todo-2: need to add logic to detect if this is root node on the page, and if so, we consider the first child the target
    scrollRelativeToNode = (dir: string, state: AppState) => {
        const currentSelNode: J.NodeInfo = S.nodeUtil.getHighlightedNode(state);
        if (!currentSelNode) return;

        let newNode: J.NodeInfo = null;

        // First detect if page root node is selected, before doing a child search
        if (currentSelNode.id === state.node.id) {
            // if going down that means first child node.
            if (dir === "down" && state.node.children && state.node.children.length > 0) {
                S.nodeUtil.highlightNode(state.node.children[0], true, state);
            }
            else if (dir === "up") {
                S.nav.navUpLevel(false);
            }
        }
        else if (state.node.children && state.node.children.length > 0) {
            let prevChild = null;
            let nodeFound = false;

            state.node.children.some((child: J.NodeInfo) => {
                let ret = false;

                if (nodeFound && dir === "down") {
                    ret = true;
                    newNode = child;
                    S.nodeUtil.highlightNode(child, true, state);
                }

                if (child.id === currentSelNode.id) {
                    if (dir === "up") {
                        if (prevChild) {
                            ret = true;
                            newNode = prevChild;
                            S.nodeUtil.highlightNode(prevChild, true, state);
                        }
                        else {
                            newNode = state.node;
                            S.nodeUtil.highlightNode(state.node, true, state);
                        }
                    }
                    nodeFound = true;
                }
                prevChild = child;

                // NOTE: returning true stops the iteration.
                return ret;
            });
        }

        if (newNode) {
            dispatch("Action_FastRefresh", (s: AppState): AppState => {
                return s;
            });
        }
    }

    scrollAllTop = (state: AppState) => {
        if (C.DEBUG_SCROLLING) {
            console.log("scrollAllTop");
        }
        let activeTabComp = S.tabUtil.getActiveTabComp(state);
        if (activeTabComp && activeTabComp.getRef()) {
            activeTabComp.getRef().scrollTop = 0;
        }

        if (state.mobileMode) {
            window.scrollTo(0, 0);
        }
        else {
            S.domUtil.getElm(C.ID_LHS, (elm: HTMLElement) => {
                elm.scrollTop = 0;
            });

            S.domUtil.getElm(C.ID_RHS, (elm: HTMLElement) => {
                elm.scrollTop = 0;
            });
        }
    }

    scrollToNode = (state: AppState, node: J.NodeInfo = null): void => {
        // S.quanta.setOverlay(true);

        let func = () => {
            // NOTE: LEAVE THIS timer code here until the new pubsub-based scrolling timing is well proven
            // setTimeout(async () => {
            //    try {
            /* Check to see if we are rendering the top node (page root), and if so
            it is better looking to just scroll to zero index, because that will always
            be what user wants to see */
            if (!node) {
                node = S.nodeUtil.getHighlightedNode(state);
            }

            /* the scrolling got slightly convoluted, so I invented 'editNodeId' just to be able to detect
             a case where the user is editing a node and we KNOW we don't need to scroll after editing,
             so this is where we detect and reset that scenario. */
            if (node && node.id === S.quanta.noScrollToId) {
                // console.log("noScrollToId flag");
                return;
            }

            if (node && state.node.id === node.id) {
                // console.log("is root, scroll to top");
                this.scrollAllTop(state);
                return;
            }

            let elm: any = null;
            if (node) {
                const nodeId: string = S.nav._UID_ROWID_PREFIX + node.id;
                // console.log("looking up using element id: " + nodeId);

                elm = S.domUtil.domElm(nodeId);
            }

            if (!elm) {
                // console.log("didn't find element yet. looking up selected one");
                elm = S.nav.getSelectedDomElement(state);
            }

            if (elm) {
                if (elm.firstElementChild) {
                    // console.log("Got first element: " + elm.firstElementChild);
                    elm = elm.firstElementChild;
                }

                if (C.DEBUG_SCROLLING) {
                    console.log("scrollIntoView elm");
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

    scrollToTop = async (): Promise<void> => {
        PubSub.subSingleOnce(C.PUBSUB_mainWindowScroll, () => {
            let state = store.getState();
            this.scrollAllTop(state);
        });
    }

    getNodeStats = async (state: AppState, trending: boolean, feed: boolean): Promise<any> => {
        const node = S.nodeUtil.getHighlightedNode(state);

        let res: J.GetNodeStatsResponse = await S.util.ajax<J.GetNodeStatsRequest, J.GetNodeStatsResponse>("getNodeStats", {
            nodeId: node ? node.id : null,
            trending,
            feed
        });
        new NodeStatsDlg(res, trending, feed, state).open();
    }

    runServerCommand = async (command: string, dlgTitle: string, dlgDescription: string, state: AppState): Promise<void> => {
        const node = S.nodeUtil.getHighlightedNode(state);

        let res: J.GetServerInfoResponse = await S.util.ajax<J.GetServerInfoRequest, J.GetServerInfoResponse>("getServerInfo", {
            command,
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

                dispatch("Action_showServerInfo", (s: AppState): AppState => {
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
