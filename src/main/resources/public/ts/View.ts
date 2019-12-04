console.log("View.ts");

import * as I from "./Interfaces";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants } from "./Constants";
import { ViewIntf } from "./intf/ViewIntf";
import { GraphDisplayDlg } from "./dlg/GraphDisplayDlg";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class View implements ViewIntf {

    docElm: any = (document.documentElement || document.body.parentNode || document.body);
    compareNodeA: I.NodeInfo;

    updateStatusBar = (): void => {
        if (!S.meta64.currentNodeData)
            return;
        var statusLine = "";

        if (S.meta64.editModeOption === S.meta64.MODE_ADVANCED) {
            if (S.meta64.currentNodeData && S.meta64.currentNodeData.node.children) {
                statusLine += "count: " + S.meta64.currentNodeData.node.children.length;
            }
        }

        if (S.meta64.userPreferences.editMode) {
            statusLine += " Selections: " + S.util.getPropertyCount(S.meta64.selectedNodes);
        }
    }

    /*
     * newId is optional parameter which, if supplied, should be the id we scroll to when finally done with the
     * render.
     */
    refreshTreeResponse = async (res?: I.RenderNodeResponse, targetId?: any, scrollToTop?: boolean): Promise<void> => {
        await S.render.renderPageFromData(res, scrollToTop, targetId);
        S.util.delayedFocus("mainNodeContent");
    }

    /*
     * newId is optional and if specified makes the page scroll to and highlight that node upon re-rendering.
     */
    refreshTree = (nodeId?: string, renderParentIfLeaf?: boolean, highlightId?: string, isInitialRender?: boolean, forceIPFSRefresh?: boolean,
        scrollToFirstChild?: boolean): void => {
    
        if (!nodeId) {
            if (S.meta64.currentNodeData && S.meta64.currentNodeData.node) {
                nodeId = S.meta64.currentNodeData.node.id;
            }
        }

        console.log("Refreshing tree: nodeId=" + nodeId);
        if (!highlightId) {
            let currentSelNode: I.NodeInfo = S.meta64.getHighlightedNode();
            highlightId = currentSelNode != null ? currentSelNode.id : nodeId;
        }

        /*
        I don't know of any reason 'refreshTree' should itself reset the offset, but I leave this comment here
        as a hint for the future.
        nav.mainOffset = 0;
        */
        S.util.ajax<I.RenderNodeRequest, I.RenderNodeResponse>("renderNode", {
            "nodeId": nodeId,
            "upLevel": null,
            "renderParentIfLeaf": !!renderParentIfLeaf,
            "offset": S.nav.mainOffset,
            "goToLastPage": false,
            "forceIPFSRefresh": forceIPFSRefresh
        }, (res: I.RenderNodeResponse) => {
            if (res.offsetOfNodeFound > -1) {
                S.nav.mainOffset = res.offsetOfNodeFound;
            }
            S.util.updateHistory(res.node);

            if (scrollToFirstChild && res.node.children && res.node.children.length > 0) {
                highlightId = res.node.children[0].id;
            }

            this.refreshTreeResponse(res, highlightId, false);
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
        S.util.ajax<I.RenderNodeRequest, I.RenderNodeResponse>("renderNode", {
            "nodeId": S.meta64.currentNodeData.node.id,
            "upLevel": null,
            "renderParentIfLeaf": true,
            "offset": S.nav.mainOffset,
            "goToLastPage": goToLastPage
        }, (res: I.RenderNodeResponse) => {
            if (goToLastPage) {
                if (res.offsetOfNodeFound > -1) {
                    S.nav.mainOffset = res.offsetOfNodeFound;
                }
            }
            S.util.updateHistory(res.node);
            this.refreshTreeResponse(res, null, true);
        });
    }

    //todo-1: need to add logic to detect if this is root node on the page, and if so, we consider the first child the target
    scrollRelativeToNode = (dir: string) => {
        let currentSelNode: I.NodeInfo = S.meta64.getHighlightedNode();
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
            S.meta64.currentNodeData.node.children.forEach((child: I.NodeInfo) => {
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

    scrollToSelectedNode = async (delay: number = 100): Promise<void> => {
        return new Promise<void>((resolve, reject) => {
            S.meta64.setOverlay(true);

            setTimeout(async () => {
                try {
                    /* Check to see if we are rendering the top node (page root), and if so
                    it is better looking to just scroll to zero index, because that will always
                    be what user wants to see */
                    let currentSelNode: I.NodeInfo = S.meta64.getHighlightedNode();
                    if (currentSelNode) {
                        console.log("Scrolling to currentSelNode.id=" + currentSelNode.id);
                    }

                    if (currentSelNode && S.meta64.currentNodeData.node.id == currentSelNode.id) {
                        this.docElm.scrollTop = 0;
                        console.log("was ROOT node. top=0");
                        return;
                    }

                    let elm: any = S.nav.getSelectedDomElement();

                    if (elm) {
                        if (elm.scrollIntoView) {
                            //As of 2019 there are lots of browsers that ONLY currently support this boolean, but more advanced
                            //way of calling this commented out below is better and we'll use that some day.
                            elm.scrollIntoView(true);
                            //elm.scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" });
                        }
                        else {
                            let elmTop = elm.getBoundingClientRect().top + document.body.scrollTop;
                            let docElmScrollTop = elmTop - S.meta64.navBarHeight;
                            this.docElm.scrollTop = docElmScrollTop;
                        }
                    }
                    else {
                        //sets vertical top position of scrollbar to zero (top), using a more simple
                        //way to scroll.
                        this.docElm.scrollTop = 0;
                    }

                } finally {
                    setTimeout(() => {
                        S.meta64.setOverlay(false);
                        resolve();
                    }, 250);
                }
            }, delay);
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

    initEditPathDisplayById = (e: HTMLElement) => {
        let node: I.NodeInfo = S.edit.editNode;

        if (S.edit.editingUnsavedNode) {
            S.util.setInnerHTML(e, "");
            S.util.setElmDisplay(e, false);
        } else {
            var pathDisplay = "<span style='overflow-x: auto;'>Path: " + node.path + "</span>";
            pathDisplay += "<br>Type: " + node.type;

            if (node.path.indexOf(node.id) != -1) {
                pathDisplay += "<br>ID: " + node.id;
            }

            if (node.lastModified) {
                let lastModStr = S.util.formatDate(new Date(node.lastModified));
                pathDisplay += "<br>Modified: " + lastModStr;
            }
            S.util.setInnerHTML(e, pathDisplay);
            S.util.setElmDisplay(e, true);
        }
    }

    graphDisplayTest = () => {
        //let node = S.meta64.getHighlightedNode();

        let dlg = new GraphDisplayDlg();
        dlg.open();
    }

    runServerCommand = (command: string) => {
        let node = S.meta64.getHighlightedNode();

        S.util.ajax<I.GetServerInfoRequest, I.GetServerInfoResponse>("getServerInfo", {
            "command": command,
            "nodeId": !!node ? node.id : null
        },
            (res: I.GetServerInfoResponse) => {
                S.util.showMessage(res.serverInfo, true);
            });
    }

    displayNotifications = (command: string) => {
        let node = S.meta64.getHighlightedNode();

        S.util.ajax<I.GetServerInfoRequest, I.GetServerInfoResponse>("getNotifications", {
            "command": command,
            "nodeId": !!node ? node.id : null
        },
            (res: I.GetServerInfoResponse) => {
                if (res.serverInfo) {
                    S.util.showMessage(res.serverInfo, false);
                }
            });
    }

    setCompareNodeA = () => {
        this.compareNodeA = S.meta64.getHighlightedNode();
    }

    compareAsBtoA = () => {
        let nodeB = S.meta64.getHighlightedNode();
        if (nodeB) {
            if (this.compareNodeA.id && nodeB.id) {
                S.util.ajax<I.CompareSubGraphRequest, I.CompareSubGraphResponse>("compareSubGraphs", //
                    { "nodeIdA": this.compareNodeA.id, "nodeIdB": nodeB.id }, //
                    (res: I.CompareSubGraphResponse) => {
                        S.util.showMessage(res.compareInfo);
                    });
            }
        }
    }

    processNodeHashes = (verify: boolean) => {
        let node = S.meta64.getHighlightedNode();
        if (node) {
            let nodeId: string = node.id;
            S.util.ajax<I.GenerateNodeHashRequest, I.GenerateNodeHashResponse>("generateNodeHash", { "nodeId": nodeId, "verify": verify },
                (res: I.GenerateNodeHashResponse) => {
                    S.util.showMessage(res.hashInfo);
                });
        }
    }
}
