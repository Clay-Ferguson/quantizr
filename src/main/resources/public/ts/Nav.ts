import { appState, dispatch, fastDispatch } from "./AppRedux";
import { AppState } from "./AppState";
import { Constants as C } from "./Constants";
import { LoginDlg } from "./dlg/LoginDlg";
import { MainMenuDlg } from "./dlg/MainMenuDlg";
import { MessageDlg } from "./dlg/MessageDlg";
import { PrefsDlg } from "./dlg/PrefsDlg";
import { SearchContentDlg } from "./dlg/SearchContentDlg";
import { NavIntf } from "./intf/NavIntf";
import * as J from "./JavaIntf";
import { PubSub } from "./PubSub";
import { Singletons } from "./Singletons";
import { Anchor } from "./widget/Anchor";
import { Heading } from "./widget/Heading";
import { VerticalLayout } from "./widget/VerticalLayout";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class Nav implements NavIntf {
    _UID_ROWID_PREFIX: string = "row_";

    /* todo-2: need to have this value passed from server rather than coded in TypeScript, however for now
    this MUST match RenderNodeService.ROWS_PER_PAGE in Java on server. */
    ROWS_PER_PAGE: number = 25;

    login = (state: AppState): void => {
        new LoginDlg(null, state).open();
    }

    logout = (state: AppState): void => {
        S.user.logout(true, state);
    }

    signup = (state: AppState): void => {
        S.user.openSignupPg(state);
    }

    preferences = (state: AppState): void => {
        new PrefsDlg(state).open();
    }

    displayingRepositoryRoot = (state: AppState): boolean => {
        if (!state.node) return false;
        // one way to detect repository root (without path, since we don't send paths back to client) is as the only node that owns itself.
        // console.log(S.util.prettyPrint(S.meta64.currentNodeData.node));
        return state.node.id === state.node.ownerId;
    }

    displayingHome = (state: AppState): boolean => {
        if (!state.node) return false;
        if (state.isAnonUser) {
            return state.node.id === state.anonUserLandingPageNode;
        } else {
            return state.node.id === state.homeNodeId;
        }
    }

    parentVisibleToUser = (state: AppState): boolean => {
        return !this.displayingHome(state);
    }

    upLevelResponse = (res: J.RenderNodeResponse, id: string, scrollToTop: boolean, state: AppState): void => {
        if (!res || !res.node || res.errorType === J.ErrorType.AUTH) {
            dispatch({
                type: "Action_ShowPageMessage",
                update: (s: AppState): void => {
                    s.pageMessage = "The node above is not shared.";
                }
            });
        } else {
            S.render.renderPageFromData(res, scrollToTop, id, true, true, state);
        }
    }

    navOpenSelectedNode = (state: AppState): void => {
        const currentSelNode: J.NodeInfo = S.meta64.getHighlightedNode(state);
        if (!currentSelNode) return;
        S.nav.cached_openNodeById(currentSelNode.id, state);
    }

    navToPrev = () => {
        S.nav.navToSibling(-1);
    }

    navToNext = () => {
        S.nav.navToSibling(1);
    }

    navToSibling = (siblingOffset: number, state?: AppState): void => {
        state = appState(state);
        if (!state.node) return null;

        S.util.ajax<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
            nodeId: state.node.id,
            upLevel: false,
            siblingOffset: siblingOffset,
            renderParentIfLeaf: true,
            offset: 0,
            goToLastPage: false,
            forceIPFSRefresh: false,
            singleNode: false
        },
            // success callback
            (res: J.RenderNodeResponse) => {
                this.upLevelResponse(res, null, true, state);
            },
            // fail callback
            (res: string) => {
                this.navHome(state);
            });
    }

    navUpLevel = (event: any = null): void => {
        const state = appState();
        if (!state.node) return null;

        if (!this.parentVisibleToUser(state)) {
            S.util.showMessage("The parent of this node isn't shared to you.", "Warning");
            // Already at root. Can't go up.
            return;
        }

        S.util.ajax<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
            nodeId: state.node.id,
            upLevel: true,
            siblingOffset: 0,
            renderParentIfLeaf: false,
            offset: 0,
            goToLastPage: false,
            forceIPFSRefresh: false,
            singleNode: false
        },
            // success callback
            (res: J.RenderNodeResponse) => {
                this.upLevelResponse(res, state.node.id, false, state);
            });
    }

    /*
     * turn of row selection DOM element of whatever row is currently selected
     */
    getSelectedDomElement = (state: AppState): HTMLElement => {
        var currentSelNode = S.meta64.getHighlightedNode(state);
        if (currentSelNode) {
            /* get node by node identifier */
            const node: J.NodeInfo = state.idToNodeMap.get(currentSelNode.id);

            if (node) {
                // console.log("found highlighted node.id=" + node.id);

                /* now make CSS id from node */
                const nodeId: string = this._UID_ROWID_PREFIX + node.id;
                // console.log("looking up using element id: "+nodeId);

                return S.util.domElm(nodeId);
            }
        }

        return null;
    }

    /* NOTE: Elements that have this as an onClick method must have the nodeId
    on an attribute of the element */
    cached_clickNodeRow = (nodeId: string, state?: AppState): void => {
        state = appState(state);

        /* First check if this node is already highlighted and if so just return */
        const hltNode = S.meta64.getHighlightedNode();
        if (hltNode && hltNode.id === nodeId) {
            return;
        }

        const node: J.NodeInfo = state.idToNodeMap.get(nodeId);
        if (!node) {
            // console.log("idToNodeMap: "+S.util.prettyPrint(state.idToNodeMap));
            throw new Error("node not found in idToNodeMap: " + nodeId);
        }

        /*
         * sets which node is selected on this page (i.e. parent node of this page being the 'key')
         */
        S.meta64.highlightNode(node, false, state);

        // There's a wierd event/ording probelm where, without this timer (delay) clicking a checkbox on a node
        // row won't get it's setter (onChange) called in time, because this refresh blows away too much state. This
        // is related to the Checkbox.ts class.
        setTimeout(() => {
            fastDispatch({
                type: "Action_FastRefresh",
                updateNew: (s: AppState): AppState => {
                    return { ...state };
                }
            });
        }, 100);
    }

    openContentNode = (nodePathOrId: string, state: AppState): void => {
        // console.log("openContentNode(): " + nodePathOrId);
        S.util.ajax<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
            nodeId: nodePathOrId,
            upLevel: false,
            siblingOffset: 0,
            renderParentIfLeaf: null,
            offset: 0,
            goToLastPage: false,
            forceIPFSRefresh: false,
            singleNode: false
        }, (res) => {
            this.navPageNodeResponse(res, state);
        });
    }

    cached_openNodeById = (id: string, state: AppState): void => {
        state = appState(state);
        const node: J.NodeInfo = state.idToNodeMap.get(id);
        S.meta64.highlightNode(node, false, state);

        if (!node) {
            S.util.showMessage("Unknown nodeId in openNodeByUid: " + id, "Warning");
        } else {
            S.view.refreshTree(node.id, true, true, null, false, true, true, state);
        }
    }

    setNodeSel = (selected: boolean, id: string, state: AppState): void => {
        state = appState(state);
        if (selected) {
            state.selectedNodes[id] = true;
        } else {
            delete state.selectedNodes[id];
        }
    }

    navPageNodeResponse = (res: J.RenderNodeResponse, state: AppState): void => {
        console.log("navPageNodeResponse.");
        S.meta64.clearSelNodes(state);
        S.render.renderPageFromData(res, true, null, true, true, state);
        S.meta64.selectTab("mainTab");
    }

    geoLocation = (state: AppState): void => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((location) => {
                new MessageDlg("Message", "Title", null,
                    new VerticalLayout([
                        new Heading(3, "Lat:" + location.coords.latitude),
                        new Heading(3, "Lon:" + location.coords.longitude),
                        new Heading(4, "+/- " + location.coords.accuracy),
                        new Anchor("https://www.google.com/maps/search/?api=1&query=" + location.coords.latitude + "," + location.coords.longitude,
                            "Show Your Google Maps Location",
                            { target: "_blank" })
                    ]), false, 0, state
                ).open();
            });
        }
        else {
            new MessageDlg("GeoLocation is not available on this device.", "Message", null, null, false, 0, state).open();
        }
    }

    showMainMenu = (state: AppState): void => {
        S.meta64.mainMenu = new MainMenuDlg();
        S.meta64.mainMenu.open();
    }

    navHome = (state: AppState): void => {
        console.log("navHome()");
        if (state.isAnonUser) {
            S.meta64.loadAnonPageHome(state);
        } else {
            // console.log("renderNode (navHome): " + state.homeNodeId);
            S.util.ajax<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
                nodeId: state.homeNodeId,
                upLevel: false,
                siblingOffset: 0,
                renderParentIfLeaf: null,
                offset: 0,
                goToLastPage: false,
                forceIPFSRefresh: false,
                singleNode: false
            }, (res) => { this.navPageNodeResponse(res, state); });
        }
    }

    navPublicHome = (state: AppState): void => {
        S.meta64.loadAnonPageHome(state);
    }

    runSearch = (): void => {
        const state = appState();
        this.cached_clickNodeRow(state.node.id);
        new SearchContentDlg(state).open();
    }

    runTimeline = (): void => {
        const state = appState();
        this.cached_clickNodeRow(state.node.id);
        S.srch.timeline("mtm", state, null, "Timeline based on Modification Time");
    }

    closeFullScreenViewer = (appState: AppState): void => {
        dispatch({
            type: "Action_CloseFullScreenViewer",
            update: (s: AppState): void => {
                s.fullScreenViewId = null;
                s.fullScreenGraphId = null;
                s.fullScreenCalendarId = null;
            }
        });
    }

    prevFullScreenImgViewer = (appState: AppState): void => {
        const prevNode: J.NodeInfo = this.getAdjacentNode("prev", appState);

        if (prevNode) {
            dispatch({
                type: "Action_PrevFullScreenImgViewer",
                update: (s: AppState): void => {
                    s.fullScreenViewId = prevNode.id;
                }
            });
        }
    }

    nextFullScreenImgViewer = (appState: AppState): void => {
        const nextNode: J.NodeInfo = this.getAdjacentNode("next", appState);

        if (nextNode) {
            dispatch({
                type: "Action_NextFullScreenImgViewer",
                update: (s: AppState): void => {
                    s.fullScreenViewId = nextNode.id;
                }
            });
        }
    }

    // todo-2: need to make view.scrollRelativeToNode use this function instead of embedding all the same logic.
    getAdjacentNode = (dir: string, state: AppState): J.NodeInfo => {

        let newNode: J.NodeInfo = null;

        // First detect if page root node is selected, before doing a child search
        if (state.fullScreenViewId === state.node.id) {
            return null;
        }
        else if (state.node.children && state.node.children.length > 0) {
            let prevChild = null;
            let nodeFound = false;

            state.node.children.some((child: J.NodeInfo) => {
                let ret = false;
                const isAnAccountNode = child.ownerId && child.id === child.ownerId;

                if (S.props.hasBinary(child) && !isAnAccountNode) {

                    if (nodeFound && dir === "next") {
                        ret = true;
                        newNode = child;
                    }

                    if (child.id === state.fullScreenViewId) {
                        if (dir === "prev") {
                            if (prevChild) {
                                ret = true;
                                newNode = prevChild;
                            }
                        }
                        nodeFound = true;
                    }
                    prevChild = child;
                }
                // NOTE: returning true stops the iteration.
                return ret;
            });
        }

        return newNode;
    }
}
