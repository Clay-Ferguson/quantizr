import * as I from "./Interfaces";
import * as J from "./JavaIntf";
import { ChangePasswordDlg } from "./dlg/ChangePasswordDlg";
import { Constants as cnst } from "./Constants";
import { Meta64Intf } from "./intf/Meta64Intf";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants } from "./Constants";
import { TypeHandlerIntf } from "./intf/TypeHandlerIntf";
import { TabPanel } from "./widget/TabPanel";
import { MainNavPanel } from "./widget/MainNavPanel";
import { GraphPanel } from "./widget/GraphPanel";
import { ManageEncryptionKeysDlg } from "./dlg/ManageEncryptionKeysDlg";

declare var chrome;

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class Meta64 implements Meta64Intf {

    navBarHeight: number = 0;
    pendingLocationHash: string;

    /* This is the state that all enablement and visibility must reference to determine how to enable gui */
    state = {
        prevPageExists: false,
        nextPageExists: false,
        selNodeCount: 0,
        highlightNode: null,
        selNodeIsMine: false,
        homeNodeSelected: false,
        importFeatureEnabled: false,
        exportFeatureEnabled: false,
        highlightOrdinal: 0,
        numChildNodes: 0,
        canMoveUp: false,
        canMoveDown: false,
        canCreateNode: false,
        propsToggle: false,
        allowEditMode: false
    };

    appInitialized: boolean = false;

    isMobile: boolean;
    isMobileOrTablet: boolean;

    curUrlPath: string = window.location.pathname + window.location.search;
    urlCmd: string;
    homeNodeOverride: string;

    /* used as a kind of 'sequence' in the app, when unique vals a needed */
    nextGuid: number = 0;

    /* name of currently logged in user */
    userName: string = "anonymous";

    /* screen capabilities */
    deviceWidth: number = 0;
    deviceHeight: number = 0;

    /*
     * User's root node. Top level of what logged in user is allowed to see.
     */
    homeNodeId: string = "";

    /*
     * specifies if this is admin user.
     */
    isAdminUser: boolean = false;
    allowBashScripting: boolean = false;

    /* always start out as anon user until login */
    isAnonUser: boolean = true;
    anonUserLandingPageNode: any = null;
    allowFileSystemSearch: boolean = false;

    /*
     * signals that data has changed and the next time we go to the main tree view window we need to refresh data
     * from the server
     */
    treeDirty: boolean = false;

    /* maps node.id values to NodeInfo.java objects */
    idToNodeMap: { [key: string]: J.NodeInfo } = {};

    /* counter for local uids */
    nextUid: number = 1;

    /*
     * Under any given node, there can be one active 'selected' node that has the highlighting, and will be scrolled
     * to whenever the page with that child is re-visited, and parentIdToFocusNodeMap holds the map of "parent id to
     * selected node (NodeInfo object)", where the key is the parent node id, and the value is the currently
     * selected node within that parent. Note this 'selection state' is only significant on the client, and only for
     * being able to scroll to the node during navigating around on the tree.
     */
    parentIdToFocusNodeMap: { [key: string]: J.NodeInfo } = {};

    /*
     * toggled by button, and holds if we are going to show properties or not on each node in the main view
     */
    showProperties: boolean = false;

    /* Flag that indicates if we are rendering owner, modTime, etc. on each row */
    showMetaData: boolean = false;

    simpleModePropertyBlackList: any = {};

    readOnlyPropertyList: any = {};

    binaryPropertyList: any = {};

    /*
     * maps all node uids to true if selected, otherwise the property should be deleted (not existing)
     */
    selectedNodes: any = {};

    /* Set of all nodes that have been expanded (from the abbreviated form) */
    expandedAbbrevNodeIds: any = {};

    /* RenderNodeResponse.java object */
    currentNodeData: J.RenderNodeResponse = null;

    typeHandlers: { [key: string]: TypeHandlerIntf } = {};

    graphPanel: GraphPanel;

    userPreferences: J.UserPreferences = {
        "editMode": false,
        "importAllowed": false,
        "exportAllowed": false,
        "showMetaData": false
    };

    refresh = (): void => {
        this.goToMainPage(true, true);
    }

    rebuildIndexes = (): void => {
        S.util.ajax<J.RebuildIndexesRequest, J.RebuildIndexesResponse>("rebuildIndexes", {}, function (res: J.RebuildIndexesResponse) {
            S.util.showMessage("Index rebuild complete.");
        });
    }

    shutdownServerNode = (): void => {
        S.util.ajax<J.ShutdownServerNodeRequest, J.ShutdownServerNodeResponse>("shutdownServerNode", {}, function (res: J.ShutdownServerNodeResponse) {
            S.util.showMessage("Server Node Shutdown initiated.");
        });
    }

    sendTestEmail = (): void => {
        S.util.ajax<J.SendTestEmailRequest, J.SendTestEmailResponse>("sendTestEmail", {}, function (res: J.SendTestEmailResponse) {
            S.util.showMessage("Send Test Email Initiated.");
        });
    }

    goToMainPage = async (rerender?: boolean, forceServerRefresh?: boolean): Promise<void> => {
        if (forceServerRefresh) {
            this.treeDirty = true;
        }

        if (rerender || this.treeDirty) {
            if (this.treeDirty) {
                S.view.refreshTree(null, true);
            } else {
                //console.log("goToMainPage.");
                await S.render.renderPageFromData();
            }
        }
        /*
         * If not re-rendering page (either from server, or from local data, then we just need to litterally switch
         * page into visible, and scroll to node)
         */
        else {
            console.log("goToMainPage calling scrollToSelectedNode");
            S.view.scrollToSelectedNode();
        }
    }

    selectTab = (tabName: string): void => {
        //console.log("selectTab: " + tabName);
        let tabElm = document.querySelector("[href='#" + tabName + "']");
        if (!tabElm) {
            //console.error("unable to find tab: " + tabName + " modify this code to use something like whenElm");

            //todo-1: fix. doing this bad wait hack for now to try again to find the element.
            setTimeout(() => {
                let tabElm = document.querySelector("[href='#" + tabName + "']");
                if (tabElm) {
                    S.util.trigger(<HTMLElement>tabElm, "click");
                }
                else {
                    console.error("unable to find tab: " + tabName + " modify this code to use something like whenElm");
                }
            }, 1000);
            return;
        }
        /* The way to select a tab with no JQuery is to simply trigger a click on the tab */
        S.util.trigger(<HTMLElement>tabElm, "click");
    }

    getSelectedNodeUidsArray = (): string[] => {
        let selArray: string[] = [];
        S.util.forEachProp(this.selectedNodes, (id, val): boolean => {
            selArray.push(id);
            return true;
        });
        return selArray;
    }

    /**
    Returns a new array of all the selected nodes each time it's called.
    */
    getSelectedNodeIdsArray = (): string[] => {
        let selArray: string[] = [];

        if (!this.selectedNodes) {
            console.log("no selected nodes.");
        } else {
            console.log("selectedNode count: " + S.util.getPropertyCount(this.selectedNodes));
        }

        S.util.forEachProp(this.selectedNodes, (id, val): boolean => {
            let node: J.NodeInfo = this.idToNodeMap[id];
            if (!node) {
                console.log("unable to find idToNodeMap for id=" + id);
            } else {
                selArray.push(node.id);
            }
            return true;
        });
        return selArray;
    }

    /* return an object with properties for each NodeInfo where the key is the id */
    getSelectedNodesAsMapById = (): Object => {
        let ret: Object = {};
        let selArray: J.NodeInfo[] = this.getSelectedNodesArray();
        if (!selArray || selArray.length == 0) {
            let highlightNode = this.getHighlightedNode();
            if (highlightNode) {
                ret[highlightNode.id] = highlightNode;
                return ret;
            }
        }

        for (let i = 0; i < selArray.length; i++) {
            let id = selArray[i].id;
            ret[id] = selArray[i];
        }
        return ret;
    }

    /* Gets selected nodes as NodeInfo.java objects array */
    getSelectedNodesArray = (): J.NodeInfo[] => {
        let selArray: J.NodeInfo[] = [];
        S.util.forEachProp(this.selectedNodes, (id, val): boolean => {
            let node = this.idToNodeMap[id];
            if (node) {
                selArray.push(node);
            }
            return true;
        });
        return selArray;
    }

    clearSelectedNodes = () => {
        this.selectedNodes = {};
    }

    selectAllNodes = (nodeIds: string[]) => {
        // DO NOT DELETE (feature work in progress)
        // //todo-1: large numbers of selected nodes isn't going to scale well in this design
        // // but i am not letting perfection be the enemy of good here (yet)
        // this.selectedNodes = {};
        // nodeIds.forEach( (nodeId, index) => {
        //     this.selectedNodes[nodeId] = true;
        // });
    }

    //note: this code is not currently in use
    updateNodeInfo = (node: J.NodeInfo) => {
        S.util.ajax<J.GetNodePrivilegesRequest, J.GetNodePrivilegesResponse>("getNodePrivileges", {
            "nodeId": node.id,
            "includeAcl": false,
            "includeOwners": true
        }, (res: J.GetNodePrivilegesResponse) => {
            //this.updateNodeInfoResponse(res, node);
        });
    }

    getHighlightedNode = (): J.NodeInfo => {
        if (!this.currentNodeData || !this.currentNodeData.node) return null;
        let ret: J.NodeInfo = this.parentIdToFocusNodeMap[this.currentNodeData.node.id];
        return ret;
    }

    highlightRowById = async (id: string, scroll: boolean): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {
            let node: J.NodeInfo = this.idToNodeMap[id];
            if (node) {
                //console.log("highlightRowById calling highlightNode");
                await this.highlightNode(node, scroll);
            } else {
                //if we can't find that node, best behvior is at least to scroll to top.
                if (scroll) {
                    S.view.scrollToTop();
                }
                console.log("highlightRowById failed to find id: " + id);
            }
            resolve();
        });
    }

    /*
     * Important: We want this to be the only method that can set values on 'parentIdToFocusNodeMap', and always
     * setting that value should go thru this function.
     */
    highlightNode = async (node: J.NodeInfo, scroll: boolean): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {
            //console.log("highlight node: " + node.id);
            if (!node) {
                console.log("ignoring null node.");
                resolve();
                return;
            }

            let activeClass = "active-row";
            let inactiveClass = "inactive-row";
            let id = this.currentNodeData.node.id;

            S.localDB.setVal(Constants.LOCALDB_LAST_PARENT_NODEID, id);
            S.localDB.setVal(Constants.LOCALDB_LAST_CHILD_NODEID, node.id);

            let doneHighlighting: boolean = false;

            /* Unhighlight currently highlighted node if any */
            let curHighlightedNode: J.NodeInfo = this.parentIdToFocusNodeMap[id];
            if (curHighlightedNode) {
                //console.log("already had a highlighted node.");
                if (curHighlightedNode.id === node.id) {
                    //console.log("nodeid " + node.uid + " was already highlighted.");
                    doneHighlighting = true;
                } else {
                    let rowElmId = "row_" + curHighlightedNode.id;
                    S.util.changeOrAddClass(rowElmId, activeClass, inactiveClass);
                }
            }

            if (!doneHighlighting) {
                this.parentIdToFocusNodeMap[id] = node;
                let rowElmId: string = "row_" + node.id;
                S.util.changeOrAddClass(rowElmId, inactiveClass, activeClass);
            }

            if (scroll) {
                //console.log("highlightNode calling scrollToSelectedNode.");
                await S.view.scrollToSelectedNode();
            }
            resolve();
        });
    }

    /*
     * Really need to use pub/sub event to broadcast enablement, and let each component do this independently and
     * decouple
     */
    updateState = () => {
        /* multiple select nodes */
        this.state.prevPageExists = S.nav.mainOffset > 0;
        this.state.nextPageExists = !S.nav.endReached;
        this.state.selNodeCount = S.util.getPropertyCount(this.selectedNodes);
        this.state.highlightNode = this.getHighlightedNode();
        this.state.selNodeIsMine = this.state.highlightNode != null && (this.state.highlightNode.owner === this.userName || "admin" === this.userName);

        this.state.homeNodeSelected = this.state.highlightNode != null && this.homeNodeId == this.state.highlightNode.id;

        //for now, allowing all users to import+export (todo-2)
        this.state.importFeatureEnabled = true; //this.isAdminUser || this.userPreferences.importAllowed;
        this.state.exportFeatureEnabled = true; //this.isAdminUser || this.userPreferences.exportAllowed;

        this.state.highlightOrdinal = this.getOrdinalOfNode(this.state.highlightNode);

        this.state.numChildNodes = this.getNumChildNodes();
        this.state.canMoveUp = this.state.highlightNode && !this.state.highlightNode.firstChild;
        this.state.canMoveDown = this.state.highlightNode && !this.state.highlightNode.lastChild;

        //todo-1: need to add to this selNodeIsMine || selParentIsMine;
        this.state.canCreateNode = this.userPreferences.editMode && this.state.highlightNode && (this.isAdminUser || (!this.isAnonUser /* && selNodeIsMine */));
        this.state.propsToggle = this.currentNodeData && this.currentNodeData.node && !this.isAnonUser;
        this.state.allowEditMode = this.currentNodeData && this.currentNodeData.node && !this.isAnonUser;
    }

    refreshAllGuiEnablement = () => {
        this.updateState();

        if (S.nav.mainNavPanel) {
            S.nav.mainNavPanel.refreshState();
        }

        // we don't refresh state on popup menu, because currently we regenerate completely each time and we
        // are calling updateState() before doing so, but aside from react performance we could do it differently if we ever need to.
        // if (S.nav.mainMenuPopupDlg) {
        //     S.nav.mainMenuPopupDlg.refreshState();
        // }
    }

    /* WARNING: This is NOT the highlighted node. This is whatever node has the CHECKBOX selection */
    getSingleSelectedNode = (): J.NodeInfo => {
        let ret = null;
        S.util.forEachProp(this.selectedNodes, (id, val): boolean => {
            // console.log("found a single Sel NodeID: " + nodeId);
            ret = this.idToNodeMap[id];
            return false;
        });
        return ret;
    }

    getOrdinalOfNode = (node: J.NodeInfo): number => {
        let ret = -1;

        if (!node || !this.currentNodeData || !this.currentNodeData.node.children)
            return ret;

        let idx = -1;
        this.currentNodeData.node.children.forEach((iterNode): boolean => {
            idx++;
            if (node.id === iterNode.id) {
                ret = idx;
                return false; //stop iterating.
            }
            return true;
        });
        return ret;
    }

    getNumChildNodes = (): number => {
        if (!this.currentNodeData || !this.currentNodeData.node || !this.currentNodeData.node.children)
            return 0;

        return this.currentNodeData.node.children.length;
    }

    setCurrentNodeData = (data: J.RenderNodeResponse): void => {
        this.currentNodeData = data;
    }

    // go ahead and make this async
    anonPageLoadResponse = (res: J.AnonPageLoadResponse): void => {

        S.util.getElm("listView", async (elm: HTMLElement) => {
            if (res.renderNodeResponse) {
                S.util.setElmDisplayById("mainNodeContent", true);

                if (res.renderNodeResponse.noDataResponse) {
                    S.util.setHtml("listView", res.renderNodeResponse.noDataResponse);

                    // how to ensure this is last in all processing pipelines (requests)??? todo-1
                    // this is very similar to the overlay and scrolling thing needing to always fall in a specific phase
                    // in specific order of certain async things
                    this.refreshAllGuiEnablement();
                }
                else {
                    //console.log("anonPageLoad");
                    await S.render.renderPageFromData(res.renderNodeResponse);
                }

            } else {
                S.util.setElmDisplayById("mainNodeContent", false);
                S.util.setHtml("listView", res.content);
            }
        });
    }

    removeBinaryById = (id: string): void => {
        if (!this.currentNodeData || !this.currentNodeData.node) return;
        this.currentNodeData.node.children.forEach((node: J.NodeInfo) => {
            if (node.id === id) {
                node.hasBinary = false;
            }
        });
    }

    /*
     * updates client side maps and client-side identifier for new node, so that this node is 'recognized' by client
     * side code
     */
    initNode = (node: J.NodeInfo, updateMaps?: boolean): void => {
        if (!node) {
            console.log("initNode has null node");
            return;
        }

        node.properties = S.props.getPropertiesInEditingOrder(node, node.properties);

        if (updateMaps) {
            this.idToNodeMap[node.id] = node;
        }
    }

    openManageKeysDlg = () => {
        new ManageEncryptionKeysDlg().open();
    }

    //here's the simple mode property hider!
    initConstants = () => {
        S.util.addAll(this.simpleModePropertyBlackList, [ //
            cnst.PRIMARY_TYPE, //
            cnst.IMG_WIDTH,//
            cnst.IMG_HEIGHT, //
            cnst.BIN_VER, //
            cnst.BIN_DATA, //
            cnst.BIN_MIME, //
            J.NodeProp.ENC, //
            cnst.BIN, //
        ]);

        S.util.addAll(this.readOnlyPropertyList, [ //
            cnst.PRIMARY_TYPE, //
            cnst.UUID, //
            cnst.IMG_WIDTH, //
            cnst.IMG_HEIGHT, //
            cnst.BIN_VER, //
            cnst.BIN_DATA, //
            cnst.BIN_MIME, //
        ]);

        S.util.addAll(this.binaryPropertyList, [cnst.BIN_DATA]);
    }

    /**
    * Detect if browser is a mobile (something smaller than tabled)
    * 
    * from: https://stackoverflow.com/questions/11381673/detecting-a-mobile-browser
    */
    mobileCheck = (): boolean => {
        let check = false;
        (function (a) { if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) check = true; })(navigator.userAgent || navigator.vendor || (window as any).opera);
        return check;
    }

    /**
     * Same check as above but includes tablets
     */
    mobileOrTabletCheck = (): boolean => {
        let check = false;
        (function (a) { if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) check = true; })(navigator.userAgent || navigator.vendor || (window as any).opera);
        return check;
    }

    initPlugins = (): void => {
        S.rssPlugin.init();
        S.coreTypesPlugin.init();
        S.bashPlugin.init();
        S.luceneIndexPlugin.init();
        S.passwordPlugin.init();
    }

    initApp = async (): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {
            console.log("initApp running.");

            this.pendingLocationHash = window.location.hash;
            this.initPlugins();

            this.isMobile = this.mobileCheck();
            this.isMobileOrTablet = this.mobileOrTabletCheck();

            // If you want to test out 'mobile' rendering, you can simply set isMobile to true here, and of course size your browser real small
            //this.isMobile = true;

            // SystemFolder and File handling stuff is disabled for now (todo-1), but will eventually be brought
            // back as a plugin similar to rssPlugin, coreTypesPlugin, etc. Also the new way of doing this
            // rendering and property ordering is what's being done in BashPlugin and CoreTypesPlugin via TypeHandlers so refer
            // to that when you ever bring back these types.
            //
            // this.renderFunctionsByType["meta64:systemfolder"] = systemfolder.renderNode;
            // this.propOrderingFunctionsByType["meta64:systemfolder"] = systemfolder.propOrdering;
            //
            // this.renderFunctionsByType["meta64:filelist"] = systemfolder.renderFileListNode;
            // this.propOrderingFunctionsByType["meta64:filelist"] = systemfolder.fileListPropOrdering;

            (window as any).addEvent = (object: any, type: any, callback: any) => {
                if (object == null || typeof (object) == 'undefined')
                    return;
                if (object.addEventListener) {
                    object.addEventListener(type, callback, false);
                } else if (object.attachEvent) {
                    object.attachEvent("on" + type, callback);
                } else {
                    object["on" + type] = callback;
                }
            };

            // leaving for future reference. Currently not needed.
            // window.onhashchange = function (e) {
            // }

            /* 
            NOTE: This works in conjunction with pushState, and is part of what it takes to make the back button (browser hisotry) work
            in the context of SPAs
            */
            window.onpopstate = (event) => {
                //console.log("POPSTATE: location: " + document.location + ", state: " + JSON.stringify(event.state));

                if (event.state && event.state.nodeId) {
                    S.view.refreshTree(event.state.nodeId, true, event.state.highlightId, false);
                    this.selectTab("mainTab");
                }
            };

            document.body.addEventListener("keydown", (event: KeyboardEvent) => {
                if (event.ctrlKey) {
                    switch (event.code) {
                        case "ArrowDown":
                            this.selectTab("mainTab");
                            S.view.scrollRelativeToNode("down");
                            break;

                        case "ArrowUp":
                            this.selectTab("mainTab");
                            S.view.scrollRelativeToNode("up");
                            break;

                        case "ArrowLeft":
                            this.selectTab("mainTab");
                            S.nav.navUpLevel();
                            break;

                        case "ArrowRight":
                            this.selectTab("mainTab");
                            S.nav.navOpenSelectedNode();
                            break;

                        default: break;
                    }
                }
            });

            if (this.appInitialized)
                return;

            this.appInitialized = true;

            this.initConstants();
            this.displaySignupMessage();

            /*
             * $ (window).on("orientationchange", _.orientationHandler);
             */

            // todo-1: actually this is a nuisance unless user is actually EDITING a node right now
            // so until i make it able to detect if user is editing i'm removing this.
            // window.onbeforeunload = () => {
            //     return "Leave Quantizr ?";
            // };

            /*
             * I thought this was a good idea, but actually it destroys the session, when the user is entering an
             * "id=\my\path" type of url to open a specific node. Need to rethink  Basically for now I'm thinking
             * going to a different url shouldn't blow up the session, which is what 'logout' does.
             *
             * $ (window).on("unload", function() { user.logout(false); });
             */

            this.deviceWidth = window.innerWidth;
            this.deviceHeight = window.innerHeight;

            S.nav.mainTabPanel = new TabPanel();
            S.nav.mainTabPanel.updateDOM("mainTabPanel");

            S.nav.mainNavPanel = new MainNavPanel(null);
            S.nav.mainNavPanel.updateDOM("mainNavPanel");

            /*
             * This call checks the server to see if we have a session already, and gets back the login information from
             * the session, and then renders page content, after that.
             */

            //this.pingServer();
            S.user.refreshLogin();

            S.util.initProgressMonitor();
            this.processUrlParams();

            this.setOverlay(false);

            // todo-1: could replace this pull with a push.
            setTimeout(() => {
                S.view.displayNotifications(null);
            }, 1000);

            setTimeout(() => {
                S.encryption.initKeys();
            }, 2000);

            // Initialize the 'ServerPush' client-side connection
            S.push.init();

            //I think for now I'm gonna make it where only individual nodes are drop-targets.
            //this.enableAppAsDropTarget();
            console.log("initApp complete.");
            resolve();
        });
    }

    /**
     * This app doesn't support drag-n-drop yet, but this code is the beginning of a proof-of-concept for that feature.
     */
    enableAppAsDropTarget = () => {
        S.util.getElm("app", (elm: HTMLElement) => {
            elm.addEventListener("dragover", function (event) {
                console.log("dragover detected.");
                // event.preventDefault();

                // //(<any>event).dataTransfer.dropEffect = 'copy';
                // (<any>event).originalEvent.dataTransfer.dropEffect = "copy";
            });

            elm.addEventListener("drop", function (event) {
                console.log("drop detected.");
                // event.preventDefault();

                // //todo-1: I plan to make this able to create a node just for this link and store it under a 'links' path
                // //of the root of the user's account (eventually will have an option to let user specify where to store these)
                // let data = (<any>event).originalEvent.dataTransfer.getData("text");

                // /* Notify the server of this drop event. Everything about a drop is handled on the server */
                // S.util.ajax<J.AppDropRequest, J.AppDropResponse>("appDrop", {
                //     "data": data
                // }, (res: J.AppDropResponse) => {
                //     console.log("AppDrop: " + data);
                //     new MessageDlg({ "message": res.message }).open();
                // });
            });
        });
    }

    /* The overlayCounter allows recursive operations which show/hide the overlay
    to happen such that if something has already shown the overlay and not hidden it yet, then 
    any number of 'sub-processes' (functionality) cannot distrupt the proper state. This is just
    the standard sort of 'reference counting' sort of algo here. Note that we initialize
    the counter to '1' and not zero since the overlay is initially visible so that's the correct
    counter state to start with.
    */
    static overlayCounter: number = 1; //this starting value is important.
    setOverlay = (showOverlay: boolean) => {
        Meta64.overlayCounter += showOverlay ? 1 : -1;
        //console.log("overlayCounter=" + Meta64.overlayCounter);

        /* if overlayCounter goes negative, that's a mismatch */
        if (Meta64.overlayCounter < 0) {
            throw new Error("Overlay calls are mismatched");
        }

        if (Meta64.overlayCounter == 1) {

            /* Whenever we are about to show the overlay always give the app 0.7 seconds before showing the overlay in case
            the app did something real fast and the display of the overlay would have just been a wasted annoyance (visually)
            and just simply caused a bit of unnecessary eye strain
            */
            setTimeout(() => {
                //after the timer we check for the counter still being greater than zero (not an ==1 this time).
                if (Meta64.overlayCounter > 0) {
                    //console.log("showing overlay.");
                    let elm = S.util.domElm("overlayDiv");
                    if (elm) {
                        elm.style.display = "block";
                        elm.style.cursor = "wait";
                    }
                }
            }, 1200);
        }
        else if (Meta64.overlayCounter == 0) {
            //console.log("hiding overlay.");
            let elm = S.util.domElm("overlayDiv");
            if (elm) {
                elm.style.display = "none";
            }
        }
        //console.log("overlayCounter="+Meta64.overlayCounter);
    }

    pingServer = () => {
        S.util.ajax<J.PingRequest, J.PingResponse>("ping", {},
            (res: J.PingResponse) => {
                console.log("Server Info: " + res.serverInfo);
            });
    }

    addTypeHandler = (typeName: string, typeHandler: TypeHandlerIntf): void => {
        this.typeHandlers[typeName] = typeHandler;
    }

    processUrlParams = (): void => {
        var passCode = S.util.getParameterByName("passCode");
        if (passCode) {
            setTimeout(() => {
                new ChangePasswordDlg({ "passCode": passCode }).open();
            }, 100);
        }

        this.urlCmd = S.util.getParameterByName("cmd");
    }

    tabChangeEvent = (tabName): void => {
        if (tabName == "searchTabName") {
            S.srch.searchTabActivated();
        }
    }

    displaySignupMessage = (): void => {
        let signupElm = S.util.domElm("signupCodeResponse");
        if (signupElm) {
            let signupResponse = signupElm.textContent;
            if (signupResponse === "ok") {
                S.util.showMessage("Signup complete.");
            }
        }
    }

    //
    // /* Don't need this method yet, and haven't tested to see if works */
    // orientationHandler = function(event): void {
    //     // if (event.orientation) {
    //     // if (event.orientation === 'portrait') {
    //     // } else if (event.orientation === 'landscape') {
    //     // }
    //     // }
    // }
    //

    loadAnonPageHome = (): void => {
        console.log("loadAnonPageHome()");
        S.util.ajax<J.AnonPageLoadRequest, J.AnonPageLoadResponse>("anonPageLoad", {
        }, this.anonPageLoadResponse);
    }

    saveUserPreferences = (): void => {
        S.util.ajax<J.SaveUserPreferencesRequest, J.SaveUserPreferencesResponse>("saveUserPreferences", {
            "userPreferences": this.userPreferences
        });
    }

    openSystemFile = (fileName: string) => {
        S.util.ajax<J.OpenSystemFileRequest, J.OpenSystemFileResponse>("openSystemFile", {
            "fileName": fileName
        });
    }

    // /* This is a wrapper around System.import, to make future refactoring needs easier, and also make the code a bit cleaner */
    // modRun(modName: string, callback: Function) {
    //     System.import("/js/" + modName).then((mod) => {
    //         callback(mod);
    //     });
    // }

    //google signon is a work in progress, not functional yet.
    onSignIn = (googleUser) => {
        var profile = googleUser.getBasicProfile();
        console.log('ID: ' + profile.getId()); // Do not send to your backend! Use an ID token instead.
        console.log('Name: ' + profile.getName());
        console.log('Image URL: ' + profile.getImageUrl());
        console.log('Email: ' + profile.getEmail()); // This is null if the 'email' scope is not present.
    }
}

