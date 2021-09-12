import { appState, dispatch } from "./AppRedux";
import { AppState } from "./AppState";
import { Constants as C } from "./Constants";
import { LoginDlg } from "./dlg/LoginDlg";
import { MainMenuDlg } from "./dlg/MainMenuDlg";
import { MessageDlg } from "./dlg/MessageDlg";
import { PrefsDlg } from "./dlg/PrefsDlg";
import { SearchContentDlg } from "./dlg/SearchContentDlg";
import { NavIntf } from "./intf/NavIntf";
import { TabDataIntf } from "./intf/TabDataIntf";
import * as J from "./JavaIntf";
import { PubSub } from "./PubSub";
import { Singletons } from "./Singletons";
import { Button } from "./widget/Button";
import { ButtonBar } from "./widget/ButtonBar";
import { Heading } from "./widget/Heading";
import { VerticalLayout } from "./widget/VerticalLayout";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class Nav implements NavIntf {
    _UID_ROWID_PREFIX: string = "row_";

    login = (state: AppState): void => {
        new LoginDlg(null, state).open();
    }

    logout = (state: AppState = null): void => {
        state = appState(state);
        S.user.logout(true, state);
    }

    signup = (state: AppState): void => {
        state = appState(state);
        S.user.openSignupPg(state);
    }

    preferences = (state: AppState): void => {
        new PrefsDlg(state).open();
    }

    displayingRepositoryRoot = (state: AppState): boolean => {
        if (!state.node) return false;
        // one way to detect repository root (without path, since we don't send paths back to client) is as the only node that owns itself.
        // console.log(S.util.prettyPrint(S.quanta.currentNodeData.node));
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
            dispatch("Action_ShowPageMessage", (s: AppState): AppState => {
                s.pageMessage = "The node above is not shared.";
                return s;
            });
        } else {
            S.render.renderPageFromData(res, scrollToTop, id, true, true);
        }
    }

    navOpenSelectedNode = (state: AppState): void => {
        const currentSelNode: J.NodeInfo = S.quanta.getHighlightedNode(state);
        if (!currentSelNode) return;
        S.nav.openNodeById(null, currentSelNode.id, state);
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
                S.quanta.clearLastNodeIds();
                this.navHome(state);
            });
    }

    navUpLevelClick = async (evt: Event = null, id: string = null): Promise<void> => {
        // for state management, especially for scrolling, we need to run the node click on the node
        // before upLeveling from it.
        await this.clickNodeRow(evt, id);
        this.navUpLevel(false);
    }

    navUpLevel = (processingDelete: boolean): void => {
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
                if (processingDelete) {
                    S.quanta.refresh(state);
                }
                else {
                    this.upLevelResponse(res, state.node.id, false, state);
                }
            },
            // fail callback
            (res: string) => {
                S.quanta.clearLastNodeIds();
                this.navHome(state);
            }
        );
    }

    /*
     * turn of row selection DOM element of whatever row is currently selected
     */
    getSelectedDomElement = (state: AppState): HTMLElement => {
        var currentSelNode = S.quanta.getHighlightedNode(state);
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
    clickNodeRow = async (evt: Event, id: string, state?: AppState): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {
            id = S.util.allowIdFromEvent(evt, id);
            state = appState(state);

            /* First check if this node is already highlighted and if so just return */
            const hltNode = S.quanta.getHighlightedNode();
            if (hltNode && hltNode.id === id) {
                resolve();
                return;
            }

            const node: J.NodeInfo = state.idToNodeMap.get(id);
            if (!node) {
                reject();
                // console.log("idToNodeMap: "+S.util.prettyPrint(state.idToNodeMap));
                throw new Error("node not found in idToNodeMap: " + id);
            }

            /*
             * sets which node is selected on this page (i.e. parent node of this page being the 'key')
             */
            S.quanta.highlightNode(node, false, state);

            // todo-1: without this timeout checkboxes on main tab don't work reliably. Need their state stored in global state to fix it
            // in a good way.
            setTimeout(() => {
                S.quanta.tempDisableAutoScroll();
                dispatch("Action_FastRefresh", (s: AppState): AppState => {
                    return s;
                });
                // console.log("nodeClickRow");
                S.util.focusId(C.TAB_MAIN);
                resolve();
            }, 100);
        });
    }

    openContentNode = (nodePathOrId: string, state: AppState = null): void => {
        state = appState(state);
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
        },
            // fail callback
            (res: string) => {
                S.quanta.clearLastNodeIds();
                this.navHome(state);
            });
    }

    openNodeById = (evt: Event, id: string, state: AppState): void => {
        id = S.util.allowIdFromEvent(evt, id);
        state = appState(state);
        const node: J.NodeInfo = state.idToNodeMap.get(id);
        S.quanta.highlightNode(node, false, state);

        if (!node) {
            S.util.showMessage("Unknown nodeId in openNodeByUid: " + id, "Warning");
        } else {
            S.view.refreshTree(node.id, true, true, null, false, true, true, state);
        }
    }

    setNodeSel = (selected: boolean, id: string, state: AppState): void => {
        if (!id) return;
        state = appState(state);
        if (selected) {
            state.selectedNodes.add(id);
        } else {
            state.selectedNodes.delete(id);
        }
    }

    navPageNodeResponse = (res: J.RenderNodeResponse, state: AppState): void => {
        S.render.renderPageFromData(res, true, null, true, true);
        S.quanta.selectTab(C.TAB_MAIN);
    }

    geoLocation = (state: AppState): void => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((location) => {
                // todo-1: make this string a configurable property template
                let googleUrl = "https://www.google.com/maps/search/?api=1&query=" + location.coords.latitude + "," + location.coords.longitude;

                new MessageDlg("Your current location...", "GEO Location", null,
                    new VerticalLayout([
                        new Heading(3, "Lat/Lon: " + location.coords.latitude + "," + location.coords.longitude),
                        new Heading(5, "Accuracy: +/- " + location.coords.accuracy + " meters (" + (location.coords.accuracy * 0.000621371).toFixed(1) + " miles)"),
                        new ButtonBar([
                            new Button("Show on Google Maps", () => {
                                window.open(googleUrl, "_blank");
                            }),
                            new Button("Copy Google Link to Clipboard", () => {
                                S.util.copyToClipboard(googleUrl);
                                S.util.flashMessage("Copied to Clipboard: " + googleUrl, "Clipboard", true);
                            })])
                    ]), false, 0, state
                ).open();
            });
        }
        else {
            new MessageDlg("GeoLocation is not available on this device.", "Message", null, null, false, 0, state).open();
        }
    }

    showMainMenu = (state: AppState): void => {
        S.quanta.mainMenu = new MainMenuDlg();
        S.quanta.mainMenu.open();
    }

    navHome = (state: AppState = null): void => {
        state = appState(state);
        S.view.scrollAllTop(state);

        // console.log("navHome()");
        if (state.isAnonUser) {
            S.quanta.loadAnonPageHome(null);
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
            }, (res) => { this.navPageNodeResponse(res, state); },
                // fail callback
                (res: string) => {
                    S.quanta.clearLastNodeIds();

                    // NOPE! This would be recursive!
                    // this.navHome(state);
                });
        }
    }

    navPublicHome = (state: AppState): void => {
        S.quanta.loadAnonPageHome(null);
    }

    runSearch = (evt: Event): void => {
        let id = S.util.allowIdFromEvent(evt, null);
        const state = appState();
        this.clickNodeRow(null, id);
        setTimeout(() => {
            new SearchContentDlg(state).open();
        }, 500);
    }

    runTimeline = (evt: Event): void => {
        let id = S.util.allowIdFromEvent(evt, null);
        const state = appState();
        this.clickNodeRow(null, id);

        setTimeout(() => {
            const node: J.NodeInfo = state.idToNodeMap.get(id);
            if (!node) {
                return;
            }
            S.srch.timeline(node, "mtm", state, null, "Rev-chron by Modify Time", 0, true);
        }, 500);
    }

    openNodeFeed = (evt: Event, id: string): void => {
        id = S.util.allowIdFromEvent(evt, id);
        const state = appState();

        let node: J.NodeInfo = state.idToNodeMap.get(id);
        // Try to get node from local memory...
        if (node) {
            setTimeout(() => {
                let feedData = S.quanta.getTabDataById(state, C.TAB_FEED);
                if (feedData) {
                    feedData.props.searchTextState.setValue("");
                }

                this.messages({
                    feedFilterFriends: false,
                    feedFilterToMe: false,
                    feedFilterFromMe: false,
                    feedFilterToPublic: true,
                    feedFilterLocalServer: true,
                    feedFilterRootNode: node,
                    feedResults: null
                });
            }, 500);
        }
        // if node not in local memory, then we have to get it from the server first...
        else {
            S.util.ajax<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
                nodeId: id,
                upLevel: false,
                siblingOffset: 0,
                renderParentIfLeaf: false,
                offset: 0,
                goToLastPage: false,
                forceIPFSRefresh: false,
                singleNode: true
            },
                (res: J.RenderNodeResponse) => {
                    if (!res.node) return;
                    let feedData = S.quanta.getTabDataById(state, C.TAB_FEED);
                    if (feedData) {
                        feedData.props.searchTextState.setValue("");
                    }
                    this.messages({
                        feedFilterFriends: false,
                        feedFilterToMe: false,
                        feedFilterFromMe: false,
                        feedFilterToPublic: true,
                        feedFilterLocalServer: true,
                        feedFilterRootNode: res.node,
                        feedResults: null
                    });
                }, // fail callback
                (res: string) => {
                    console.log("failed to refresh node: " + res);
                });
        }
    }

    closeFullScreenViewer = (appState: AppState): void => {
        dispatch("Action_CloseFullScreenViewer", (s: AppState): AppState => {
            s.fullScreenViewId = null;
            s.fullScreenGraphId = null;
            s.fullScreenCalendarId = null;
            return s;
        });
    }

    prevFullScreenImgViewer = (appState: AppState): void => {
        const prevNode: J.NodeInfo = this.getAdjacentNode("prev", appState);

        if (prevNode) {
            dispatch("Action_PrevFullScreenImgViewer", (s: AppState): AppState => {
                s.fullScreenViewId = prevNode.id;
                return s;
            });
        }
    }

    nextFullScreenImgViewer = (appState: AppState): void => {
        const nextNode: J.NodeInfo = this.getAdjacentNode("next", appState);

        if (nextNode) {
            dispatch("Action_NextFullScreenImgViewer", (s: AppState): AppState => {
                s.fullScreenViewId = nextNode.id;
                return s;
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

    messages = (props: Object): void => {
        let feedData: TabDataIntf = S.quanta.getTabDataById(null, C.TAB_FEED);
        if (!feedData) {
            return;
        }

        dispatch("Action_SelectTab", (s: AppState): AppState => {
            s.guiReady = true;
            S.quanta.tabChanging(s.activeTab, C.TAB_FEED, s);
            s.activeTab = S.quanta.activeTab = C.TAB_FEED;

            // merge props prarmeter into the feed data props.
            feedData.props = { ...feedData.props, ...props };
            return s;
        });
        setTimeout(S.srch.refreshFeed, 10);
    }
}
