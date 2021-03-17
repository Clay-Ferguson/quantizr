import { fastDispatch } from "./AppRedux";
import { AppState } from "./AppState";
import { Constants as C } from "./Constants";
import { NodeStatsDlg } from "./dlg/NodeStatsDlg";
import { ViewIntf } from "./intf/ViewIntf";
import * as J from "./JavaIntf";
import { Log } from "./Log";
import { PubSub } from "./PubSub";
import { Singletons } from "./Singletons";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

// This is magically defined in webpack.common.js;
declare var BUILDTIME;
declare var PROFILE;

export class View implements ViewIntf {

    docElm: any = (document.documentElement || document.body.parentNode || document.body);

    /*
     * newId is optional and if specified makes the page scroll to and highlight that node upon re-rendering.
     */
    refreshTree = (nodeId: string, zeroOffset: boolean, renderParentIfLeaf: boolean, highlightId: string, forceIPFSRefresh: boolean,
        allowScroll: boolean, setTab: boolean, state: AppState): void => {
        // console.log("refreshTree with ID=" + nodeId);
        if (!nodeId && state.node) {
            nodeId = state.node.id;
        }

        if (!highlightId) {
            const currentSelNode: J.NodeInfo = S.meta64.getHighlightedNode(state);
            highlightId = currentSelNode ? currentSelNode.id : nodeId;
        }

        let offset = 0;
        if (!zeroOffset) {
            let firstChild: J.NodeInfo = S.edit.getFirstChildNode(state);
            offset = firstChild ? firstChild.logicalOrdinal : 0;
        }

        S.util.ajax<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
            nodeId,
            upLevel: false,
            siblingOffset: 0,
            renderParentIfLeaf,
            offset,
            goToLastPage: false,
            forceIPFSRefresh,
            singleNode: false
        }, async (res: J.RenderNodeResponse) => {
            S.render.renderPageFromData(res, false, highlightId, setTab, allowScroll, state);
        });
    }

    firstPage = (state: AppState): void => {
        this.loadPage(false, 0, state);
    }

    prevPage = (state: AppState): void => {
        let firstChildNode: J.NodeInfo = S.edit.getFirstChildNode(state);
        if (firstChildNode && firstChildNode.logicalOrdinal > 0) {
            let targetOffset = firstChildNode.logicalOrdinal - S.nav.ROWS_PER_PAGE;
            if (targetOffset < 0) {
                targetOffset = 0;
            }

            this.loadPage(false, targetOffset, state);
        }
    }

    nextPage = (state: AppState): void => {
        let lastChildNode: J.NodeInfo = S.edit.getLastChildNode(state);
        if (lastChildNode) {
            let targetOffset = lastChildNode.logicalOrdinal + 1;
            this.loadPage(false, targetOffset, state);
        }
    }

    lastPage = (state: AppState): void => {
        // console.log("Running lastPage Query");
        // nav.mainOffset += nav.ROWS_PER_PAGE;
        // this.loadPage(true, targetOffset, state);
    }

    private loadPage = (goToLastPage: boolean, offset: number, state: AppState): void => {
        S.util.ajax<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
            nodeId: state.node.id,
            upLevel: false,
            siblingOffset: 0,
            renderParentIfLeaf: true,
            offset,
            goToLastPage: goToLastPage,
            forceIPFSRefresh: false,
            singleNode: false
        }, async (res: J.RenderNodeResponse) => {
            S.render.renderPageFromData(res, true, null, true, true, state);
        });
    }

    // todo-2: need to add logic to detect if this is root node on the page, and if so, we consider the first child the target
    scrollRelativeToNode = (dir: string, state: AppState) => {
        const currentSelNode: J.NodeInfo = S.meta64.getHighlightedNode(state);
        if (!currentSelNode) return;

        let newNode: J.NodeInfo = null;

        // First detect if page root node is selected, before doing a child search
        if (currentSelNode.id === state.node.id) {
            // if going down that means first child node.
            if (dir === "down" && state.node.children && state.node.children.length > 0) {
                S.meta64.highlightNode(state.node.children[0], true, state);
            }
            else if (dir === "up") {
                S.nav.navUpLevel();
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
                    S.meta64.highlightNode(child, true, state);
                }

                if (child.id === currentSelNode.id) {
                    if (dir === "up") {
                        if (prevChild) {
                            ret = true;
                            newNode = prevChild;
                            S.meta64.highlightNode(prevChild, true, state);
                        }
                        else {
                            newNode = state.node;
                            S.meta64.highlightNode(state.node, true, state);
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
            fastDispatch({
                type: "Action_FastRefresh",
                updateNew: (s: AppState): AppState => {
                    return { ...state };
                }
            });
        }
    }

    scrollToSelectedNode = (state: AppState): void => {
        // S.meta64.setOverlay(true);

        let func = () => {
            // NOTE: LEAVE THIS timer code here until the new pubsub-based scrolling timing is well proven
            // setTimeout(async () => {
            //    try {
            /* Check to see if we are rendering the top node (page root), and if so
            it is better looking to just scroll to zero index, because that will always
            be what user wants to see */
            const currentSelNode: J.NodeInfo = S.meta64.getHighlightedNode(state);
            if (currentSelNode && state.node.id === currentSelNode.id) {
                // Log.log("setting scrollTop=0 (a)");
                this.docElm.scrollTop = 0;
                return;
            }

            let elm: any = S.nav.getSelectedDomElement(state);
            if (elm) {
                if (elm.firstElementChild) {
                    // console.log("Got first element: " + elm.firstElementChild);
                    elm = elm.firstElementChild;
                }

                // Log.log("scrollIntoView element");
                elm.scrollIntoView(true);
            }
            else {
                // Log.log("setting scrollTop=0 (b)");
                this.docElm.scrollTop = 0;
            }
        };
        //     } finally {
        //         setTimeout(() => {
        //             S.meta64.setOverlay(false);
        //         }, 100);
        //     }
        // }, 100);

        PubSub.subSingleOnce(C.PUBSUB_mainWindowScroll, () => {
            // console.log("execute: C.PUBSUB_mainRenderComplete");
            func();
        });
    }

    scrollToTop = async (): Promise<void> => {
        // NOTE: LEAVE THIS timer code here until the new pubsub-based scrolling timing is well proven
        // return new Promise<void>((resolve, reject) => {
        //     setTimeout(() => {
        //         console.log("scrollTop()");
        //         this.docElm.scrollTop = 0;
        //         resolve();
        //     }, 100);
        // });

        PubSub.subSingleOnce(C.PUBSUB_mainWindowScroll, () => {
            // Log.log("execute: C.PUBSUB_mainRenderComplete");
            this.docElm.scrollTop = 0;
        });
    }

    getNodeStats = (state: AppState, trending: boolean, feed: boolean) => {
        const node = S.meta64.getHighlightedNode(state);

        S.util.ajax<J.GetNodeStatsRequest, J.GetNodeStatsResponse>("getNodeStats", {
            nodeId: node ? node.id : null,
            trending,
            feed
        },
            (res: J.GetNodeStatsResponse) => {
                new NodeStatsDlg(res, trending, feed, state).open();
            });
    }

    runServerCommand = (command: string, dlgTitle: string, dlgDescription: string, state: AppState) => {
        const node = S.meta64.getHighlightedNode(state);

        S.util.ajax<J.GetServerInfoRequest, J.GetServerInfoResponse>("getServerInfo", {
            command: command,
            nodeId: node ? node.id : null
        },
            (res: J.GetServerInfoResponse) => {

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

                        S.util.showMessage(m.message, dlgTitle || "Server Reply", true);
                    });
                }
            });
    }
}
