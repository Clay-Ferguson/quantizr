import * as J from "./JavaIntf";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants as C } from "./Constants";
import { ViewIntf } from "./intf/ViewIntf";
import { GraphDisplayDlg } from "./dlg/GraphDisplayDlg";

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
     * todo-0: everywhere that calls this needs to pass mstate
     */
    refreshTree = (nodeId: string, renderParentIfLeaf: boolean, highlightId: string, isInitialRender: boolean, forceIPFSRefresh: boolean, 
        mstate: any): void => {
        console.log("refreshTree()");

        if (!nodeId) {
            if (S.meta64.currentNodeData && S.meta64.currentNodeData.node) {
                nodeId = S.meta64.currentNodeData.node.id;
            }
        }

        if (S.meta64.currentNodeData && mstate) {
            S.render.updateHighlightNode(S.meta64.currentNodeData.node, mstate.highlightNode);
        }

        console.log("Refreshing tree: nodeId=" + nodeId);
        if (!highlightId) {
            let currentSelNode: J.NodeInfo = S.meta64.getHighlightedNode();
            highlightId = currentSelNode != null ? currentSelNode.id : nodeId;
        }

        /*
        I don't know of any reason 'refreshTree' should itself reset the offset, but I leave this comment here
        as a hint for the future.
        nav.mainOffset = 0;
        */
        S.util.ajax<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
            "nodeId": nodeId,
            "upLevel": null,
            "siblingOffset": 0,
            "renderParentIfLeaf": !!renderParentIfLeaf,
            "offset": S.nav.mainOffset,
            "goToLastPage": false,
            "forceIPFSRefresh": forceIPFSRefresh
        }, async (res: J.RenderNodeResponse) => {
            if (res.offsetOfNodeFound > -1) {
                S.nav.mainOffset = res.offsetOfNodeFound;
            }
            await S.render.renderPageFromData(res, false, highlightId);
        });
    }

    firstPage = (): void => {
        console.log("Running firstPage Query");
        S.nav.mainOffset = 0;
        this.loadPage(false);
    }

    prevPage = (): void => {
        console.log("Running prevPage Query");
        S.nav.mainOffset -= S.nav.ROWS_PER_PAGE;
        if (S.nav.mainOffset < 0) {
            S.nav.mainOffset = 0;
        }
        this.loadPage(false);
    }

    nextPage = (): void => {
        console.log("Running nextPage Query");
        S.nav.mainOffset += S.nav.ROWS_PER_PAGE;
        this.loadPage(false);
    }

    lastPage = (): void => {
        console.log("Running lastPage Query");
        //nav.mainOffset += nav.ROWS_PER_PAGE;
        this.loadPage(true);
    }

    private loadPage = (goToLastPage: boolean): void => {
        console.log("loadPage()");
        S.util.ajax<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
            "nodeId": S.meta64.currentNodeData.node.id,
            "upLevel": null,
            "siblingOffset": 0,
            "renderParentIfLeaf": true,
            "offset": S.nav.mainOffset,
            "goToLastPage": goToLastPage,
            "forceIPFSRefresh": false
        }, async (res: J.RenderNodeResponse) => {
            if (goToLastPage) {
                if (res.offsetOfNodeFound > -1) {
                    S.nav.mainOffset = res.offsetOfNodeFound;
                }
            }
            await S.render.renderPageFromData(res, true, null);
        });
    }

    //todo-1: need to add logic to detect if this is root node on the page, and if so, we consider the first child the target
    scrollRelativeToNode = (dir: string) => {
        let currentSelNode: J.NodeInfo = S.meta64.getHighlightedNode();
        if (!currentSelNode) return;

        //First detect if page root node is selected, before doing a child search
        if (currentSelNode.id == S.meta64.currentNodeData.node.id) {
            //if going down that means first child node.
            if (dir == "down" && S.meta64.currentNodeData.node.children && S.meta64.currentNodeData.node.children.length > 0) {
                S.meta64.highlightNode(S.meta64.currentNodeData.node.children[0], true);
            }
            else if (dir == "up") {
                S.nav.navUpLevel();
            }
            return;
        }

        if (S.meta64.currentNodeData.node.children && S.meta64.currentNodeData.node.children.length > 0) {
            let prevChild = null;
            let nodeFound = false;
            let done = false;
            S.meta64.currentNodeData.node.children.forEach((child: J.NodeInfo) => {
                if (done) return;

                if (nodeFound && dir === "down") {
                    done = true;
                    S.meta64.highlightNode(child, true);
                }

                if (child.id == currentSelNode.id) {
                    if (dir === "up") {
                        if (prevChild) {
                            done = true;
                            S.meta64.highlightNode(prevChild, true);
                        }
                        else {
                            S.meta64.highlightNode(S.meta64.currentNodeData.node, true);
                        }
                    }
                    nodeFound = true;
                }
                prevChild = child;
            });
        }
    }

    scrollToSelectedNode = async (): Promise<void> => {
        return new Promise<void>((resolve, reject) => {
            S.meta64.setOverlay(true);

            setTimeout(async () => {
                try {
                    /* Check to see if we are rendering the top node (page root), and if so
                    it is better looking to just scroll to zero index, because that will always
                    be what user wants to see */
                    let currentSelNode: J.NodeInfo = S.meta64.getHighlightedNode();
                    if (currentSelNode && S.meta64.currentNodeData.node.id == currentSelNode.id) {
                        this.docElm.scrollTop = 0;
                        return;
                    }

                    let elm: any = S.nav.getSelectedDomElement();
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
                        resolve();
                    }, 100);
                }
            }, 100);
        });
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
        if (node.type && node.type != "u" && node.type != "nt:unstructured") {
            if (path) {
                path += "  ";
            }
            path += "Type: " + node.type;
        }
        return path;
    }

    graphDisplayTest = () => {
        //let node = S.meta64.getHighlightedNode();

        let dlg = new GraphDisplayDlg();
        dlg.open();
    }

    runServerCommand = (command: string) => {
        let node = S.meta64.getHighlightedNode();

        S.util.ajax<J.GetServerInfoRequest, J.GetServerInfoResponse>("getServerInfo", {
            "command": command,
            "nodeId": !!node ? node.id : null
        },
            (res: J.GetServerInfoResponse) => {
                /* a bit confusing here but this command is the same as the name of the AJAX call above (getServerInfo), but
                there are other commands that exist also */
                if (command == "getServerInfo") {
                    res.serverInfo += "<br>Browser Memory: "+S.util.getBrowserMemoryInfo();
                    res.serverInfo += "<br>Build Time: " + BUILDTIME;
                    res.serverInfo += "<br>Profile: " + PROFILE;
                }
                S.util.showMessage(res.serverInfo, true);
            });
    }

    displayNotifications = (command: string) => {
        let node = S.meta64.getHighlightedNode();

        S.util.ajax<J.GetServerInfoRequest, J.GetServerInfoResponse>("getNotifications", {
            "command": command,
            "nodeId": !!node ? node.id : null
        },
            (res: J.GetServerInfoResponse) => {
                if (res.serverInfo) {
                    S.util.showMessage(res.serverInfo, false);
                }
            });
    }
}
