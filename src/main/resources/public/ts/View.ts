import * as J from "./JavaIntf";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants as C } from "./Constants";
import { ViewIntf } from "./intf/ViewIntf";
import { GraphDisplayDlg } from "./dlg/GraphDisplayDlg";
import { AppState } from "./AppState";
import { fastDispatch } from "./AppRedux";
import { InboxNotifyDlg } from "./dlg/InboxNotifyDlg";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

//This is magically defined in webpack.common.js;
declare var BUILDTIME;
declare var PROFILE;

export class View implements ViewIntf {

    docElm: any = (document.documentElement || document.body.parentNode || document.body);

    /*
     * newId is optional and if specified makes the page scroll to and highlight that node upon re-rendering.
     */
    refreshTree = (nodeId: string, renderParentIfLeaf: boolean, highlightId: string, isInitialRender: boolean, forceIPFSRefresh: boolean,
        allowScroll: boolean, setTab: boolean, state: AppState): void => {

        if (!nodeId && state.node) {
            nodeId = state.node.id;
        }

        if (!highlightId) {
            let currentSelNode: J.NodeInfo = S.meta64.getHighlightedNode(state);
            highlightId = currentSelNode != null ? currentSelNode.id : nodeId;
        }

        S.util.ajax<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
            nodeId: nodeId,
            upLevel: null,
            siblingOffset: 0,
            renderParentIfLeaf: !!renderParentIfLeaf,
            offset: S.nav.mainOffset,
            goToLastPage: false,
            forceIPFSRefresh,
            singleNode: false
        }, async (res: J.RenderNodeResponse) => {
            if (res.offsetOfNodeFound > -1) {
                S.nav.mainOffset = res.offsetOfNodeFound;
            }
            S.render.renderPageFromData(res, false, highlightId, setTab, allowScroll, state);
        });
    }

    firstPage = (state: AppState): void => {
        console.log("Running firstPage Query");
        S.nav.mainOffset = 0;
        this.loadPage(false, state);
    }

    prevPage = (state: AppState): void => {
        console.log("Running prevPage Query");
        S.nav.mainOffset -= S.nav.ROWS_PER_PAGE;
        if (S.nav.mainOffset < 0) {
            S.nav.mainOffset = 0;
        }
        this.loadPage(false, state);
    }

    nextPage = (state: AppState): void => {
        console.log("Running nextPage Query");
        S.nav.mainOffset += S.nav.ROWS_PER_PAGE;
        this.loadPage(false, state);
    }

    lastPage = (state: AppState): void => {
        console.log("Running lastPage Query");
        //nav.mainOffset += nav.ROWS_PER_PAGE;
        this.loadPage(true, state);
    }

    private loadPage = (goToLastPage: boolean, state: AppState): void => {
        S.util.ajax<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
            nodeId: state.node.id,
            upLevel: null,
            siblingOffset: 0,
            renderParentIfLeaf: true,
            offset: S.nav.mainOffset,
            goToLastPage: goToLastPage,
            forceIPFSRefresh: false,
            singleNode: false
        }, async (res: J.RenderNodeResponse) => {
            if (goToLastPage) {
                if (res.offsetOfNodeFound > -1) {
                    S.nav.mainOffset = res.offsetOfNodeFound;
                }
            }

            S.render.renderPageFromData(res, true, null, true, true, state);
        });
    }

    //todo-1: need to add logic to detect if this is root node on the page, and if so, we consider the first child the target
    scrollRelativeToNode = (dir: string, state: AppState) => {
        let currentSelNode: J.NodeInfo = S.meta64.getHighlightedNode(state);
        if (!currentSelNode) return;

        let newNode: J.NodeInfo = null;

        //First detect if page root node is selected, before doing a child search
        if (currentSelNode.id == state.node.id) {
            //if going down that means first child node.
            if (dir == "down" && state.node.children && state.node.children.length > 0) {
                S.meta64.highlightNode(state.node.children[0], true, state);
            }
            else if (dir == "up") {
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

                if (child.id == currentSelNode.id) {
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

                //NOTE: returning true stops the iteration.
                return ret;
            });
        }

        if (newNode) {
            /* We do this async just to make the fastest possible response when clicking on a node */
            setTimeout(() => {
                S.util.updateHistory(null, newNode, state);
            }, 10);

            fastDispatch({
                type: "Action_FastRefresh",
                updateNew: (s: AppState): AppState => {
                    return { ...state };
                }
            });
        }
    }

    scrollToSelectedNode = (state: AppState): void => {

        //todo-1: is this still good? the overlay ?
        S.meta64.setOverlay(true);

        setTimeout(async () => {
            try {
                /* Check to see if we are rendering the top node (page root), and if so
                it is better looking to just scroll to zero index, because that will always
                be what user wants to see */
                let currentSelNode: J.NodeInfo = S.meta64.getHighlightedNode(state);
                if (currentSelNode && state.node.id == currentSelNode.id) {
                    this.docElm.scrollTop = 0;
                    return;
                }

                let elm: any = S.nav.getSelectedDomElement(state);
                if (elm) {
                    elm.scrollIntoView(true);

                    //the 'scrollIntoView' function doesn't work well when we have margin/padding on the document (for our toolbar at the top)
                    //so we have to account for that by scrolling up a bit from where the 'scrollIntoView' will have put is.
                    //Only in the rare case of the very last node on the page will this have slightly undesirable effect of
                    //scrolling up more than we wanted to, but instead of worrying about that I'm keeping this simple.

                    scrollBy(0, -S.meta64.navBarHeight);
                }
                else {
                    this.docElm.scrollTop = 0;
                }

            } finally {
                setTimeout(() => {
                    S.meta64.setOverlay(false);
                }, 100);
            }
        }, 100);
    }

    scrollToTop = async (): Promise<void> => {
        return new Promise<void>((resolve, reject) => {
            setTimeout(() => {
                this.docElm.scrollTop = 0;
                resolve();
            }, 250);
        });
    }

    getPathDisplay = (node: J.NodeInfo): string => {
        if (node == null) return "";
        var path = "ID: " + node.id;

        if (node.lastModified) {
            if (path) {
                path += "  ";
            }
            let lastModStr = S.util.formatDate(new Date(node.lastModified));
            path += "(Mod: " + lastModStr + ")";
        }

        //todo-1: nt:unstructured is included just for legacy support unless/until I put into DB converter.
        if (node.type && node.type != J.NodeType.NONE && node.type != "nt:unstructured") {
            if (path) {
                path += "  ";
            }
            path += "Type: " + node.type;
        }
        return path;
    }

    graphDisplayTest = (state: AppState) => {
        let dlg = new GraphDisplayDlg(state);
        dlg.open();
    }

    runServerCommand = (command: string, state: AppState) => {
        let node = S.meta64.getHighlightedNode(state);

        S.util.ajax<J.GetServerInfoRequest, J.GetServerInfoResponse>("getServerInfo", {
            command: command,
            nodeId: !!node ? node.id : null
        },
            (res: J.GetServerInfoResponse) => {

                if (res.messages) {
                    res.messages.forEach(m => {
                        /* a bit confusing here but this command is the same as the name of the AJAX call above (getServerInfo), but
                  there are other commands that exist also */
                        if (command == "getServerInfo") {
                            m.message += "<br>Browser Memory: " + S.util.getBrowserMemoryInfo();
                            m.message += "<br>Build Time: " + BUILDTIME;
                            m.message += "<br>Profile: " + PROFILE;
                        }
                        S.util.showMessage(m.message, "Command Complete", true);
                    });
                }
            });
    }

    displayNotifications = (command: string, state: AppState) => {
        let node = S.meta64.getHighlightedNode(state);

        S.util.ajax<J.GetServerInfoRequest, J.GetServerInfoResponse>("getNotifications", {
            command: command,
            nodeId: !!node ? node.id : null
        },
            (res: J.GetServerInfoResponse) => {
                if (res.messages) {
                    res.messages.forEach(m => {
                        if (m.type != "inbox") {
                            //todo-1: really need to put ALL messages into a single dialog display
                            S.util.showMessage(m.message, "Notifications", false);
                        }
                    });

                    res.messages.forEach(m => {
                        if (m.type == "inbox") {
                            new InboxNotifyDlg(m.message, state).open();
                        }
                    });
                }
            });
    }
}
