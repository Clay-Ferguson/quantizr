import { dispatch, getAppState } from "./AppRedux";
import { AppState } from "./AppState";
import { Button } from "./comp/core/Button";
import { ButtonBar } from "./comp/core/ButtonBar";
import { Heading } from "./comp/core/Heading";
import { VerticalLayout } from "./comp/core/VerticalLayout";
import { Constants as C } from "./Constants";
import { MainMenuDlg } from "./dlg/MainMenuDlg";
import { MessageDlg } from "./dlg/MessageDlg";
import { SearchContentDlg } from "./dlg/SearchContentDlg";
import { FullScreenType } from "./Interfaces";
import * as J from "./JavaIntf";
import { S } from "./Singletons";
import { FeedTab } from "./tabs/data/FeedTab";
import { TrendingTab } from "./tabs/data/TrendingTab";

export class Nav {
    _UID_ROWID_PREFIX: string = "row_";

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

    upLevelResponse = (res: J.RenderNodeResponse, id: string, scrollToTop: boolean, state: AppState) => {
        if (!res || !res.node || res.errorType === J.ErrorType.AUTH) {
            S.util.showPageMessage("The node above is not shared.");
        } else {
            S.render.renderPage(res, scrollToTop, id, true, true);
        }
    }

    navOpenSelectedNode = (state: AppState) => {
        const selNode = S.nodeUtil.getHighlightedNode(state);
        if (!selNode) return;
        if (C.DEBUG_SCROLLING) {
            console.log("navOpenSelectedNode");
        }
        S.nav.openNodeById(null, selNode.id, state);
    }

    navToPrev = () => {
        S.nav.navToSibling(-1);
    }

    navToNext = () => {
        S.nav.navToSibling(1);
    }

    navToSibling = async (siblingOffset: number, state?: AppState): Promise<string> => {
        state = getAppState(state);
        if (!state.node) return null;

        try {
            const res = await S.util.ajax<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
                nodeId: state.node.id,
                upLevel: false,
                siblingOffset: siblingOffset,
                renderParentIfLeaf: true,
                forceRenderParent: false,
                offset: 0,
                goToLastPage: false,
                forceIPFSRefresh: false,
                singleNode: false,
                parentCount: state.userPrefs.showParents ? 1 : 0
            });
            this.upLevelResponse(res, null, true, state);
        }
        catch (e) {
            S.nodeUtil.clearLastNodeIds();
            // this.navHome(state);
        }
    }

    navUpLevelClick = async (evt: Event = null, id: string = null) => {
        // for state management, especially for scrolling, we need to run the node click on the node
        // before upLeveling from it.
        await this.clickNodeRow(evt, id);
        this.navUpLevel(false);
    }

    navUpLevel = async (processingDelete: boolean): Promise<void> => {
        const state = getAppState();
        if (!state.node) return null;

        if (!this.parentVisibleToUser(state)) {
            S.util.showMessage("The parent of this node isn't shared to you.", "Warning");
            // Already at root. Can't go up.
            return;
        }

        try {
            const res = await S.util.ajax<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
                nodeId: state.node.id,
                upLevel: true,
                siblingOffset: 0,
                renderParentIfLeaf: false,
                forceRenderParent: false,
                offset: 0,
                goToLastPage: false,
                forceIPFSRefresh: false,
                singleNode: false,
                parentCount: state.userPrefs.showParents ? 1 : 0
            });

            if (processingDelete) {
                S.quanta.refresh(state);
            }
            else {
                this.upLevelResponse(res, state.node.id, false, state);
            }
        }
        catch (e) {
            S.nodeUtil.clearLastNodeIds();
            // this.navHome(state);
        }
    }

    /*
     * turn of row selection DOM element of whatever row is currently selected
     */
    getSelectedDomElement = (state: AppState): HTMLElement => {
        const selNode = S.nodeUtil.getHighlightedNode(state);
        if (selNode) {
            /* get node by node identifier */
            const node = state.idToNodeMap.get(selNode.id);

            if (node) {
                // console.log("found highlighted node.id=" + node.id);

                /* now make CSS id from node */
                const nodeId: string = this._UID_ROWID_PREFIX + node.id;
                // console.log("looking up using element id: "+nodeId);

                return S.domUtil.domElm(nodeId);
            }
        }
        return null;
    }

    /* NOTE: Elements that have this as an onClick method must have the nodeId
    on an attribute of the element */
    clickNodeRow = async (evt: Event, id: string, state?: AppState) => {
        // since we resolve inside the timeout async/wait pattern is not used here.
        return new Promise<void>(async (resolve, reject) => {
            id = S.util.allowIdFromEvent(evt, id);
            state = getAppState(state);

            /* First check if this node is already highlighted and if so just return */
            const hltNode = S.nodeUtil.getHighlightedNode();
            if (hltNode?.id === id) {
                resolve();
                return;
            }

            const node = state.idToNodeMap.get(id);
            if (!node) {
                reject();
                // console.log("idToNodeMap: "+S.util.prettyPrint(state.idToNodeMap));
                throw new Error("node not found in idToNodeMap: " + id);
            }

            /*
             * sets which node is selected on this page (i.e. parent node of this page being the 'key')
             */
            dispatch("HighlightNode", s => {
                S.nodeUtil.highlightNode(node, false, s);
                return s;
            });

            // console.log("nodeClickRow. Focusing Main tab");
            S.domUtil.focusId(C.TAB_MAIN);
            resolve();
        });
    }

    openContentNode = async (nodePathOrId: string, state: AppState = null) => {
        state = getAppState(state);
        // console.log("openContentNode(): " + nodePathOrId);

        try {
            const res = await S.util.ajax<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
                nodeId: nodePathOrId,
                upLevel: false,
                siblingOffset: 0,
                renderParentIfLeaf: null,
                forceRenderParent: false,
                offset: 0,
                goToLastPage: false,
                forceIPFSRefresh: false,
                singleNode: false,
                parentCount: state.userPrefs.showParents ? 1 : 0
            });
            this.navPageNodeResponse(res, state);
        }
        catch (e) {
            S.nodeUtil.clearLastNodeIds();
            // this.navHome(state);
        }
    }

    openNodeById = (evt: Event, id: string, state: AppState) => {
        id = S.util.allowIdFromEvent(evt, id);
        state = getAppState(state);
        const node = state.idToNodeMap.get(id);
        S.nodeUtil.highlightNode(node, false, state);

        if (!node) {
            S.util.showMessage("Unknown nodeId in openNodeByUid: " + id, "Warning");
        } else {
            if (C.DEBUG_SCROLLING) {
                console.log("openNodeById");
            }
            // NOTE: Passing true for "scrollToTop" is new on 11/6/21
            S.view.refreshTree({
                nodeId: node.id,
                zeroOffset: true,
                renderParentIfLeaf: true,
                highlightId: null,
                forceIPFSRefresh: false,
                scrollToTop: true,
                allowScroll: true,
                setTab: true,
                forceRenderParent: false,
                state
            });
        }
    }

    setNodeSel = (selected: boolean, id: string, state: AppState) => {
        if (!id) return;
        state = getAppState(state);
        if (selected) {
            state.selectedNodes.add(id);
        } else {
            state.selectedNodes.delete(id);
        }
    }

    navPageNodeResponse = (res: J.RenderNodeResponse, state: AppState) => {
        S.render.renderPage(res, true, null, true, true);
        S.tabUtil.selectTab(C.TAB_MAIN);
    }

    geoLocation = (state: AppState) => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((location) => {
                // todo-2: make this string a configurable property template
                const googleUrl = "https://www.google.com/maps/search/?api=1&query=" + location.coords.latitude + "," + location.coords.longitude;

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
                    ]), false, 0, null
                ).open();
            });
        }
        else {
            new MessageDlg("GeoLocation is not available on this device.", "Message", null, null, false, 0, null).open();
        }
    }

    showMainMenu = (state: AppState) => {
        S.quanta.mainMenu = new MainMenuDlg();
        S.quanta.mainMenu.open();
    }

    navHome = async (state: AppState = null) => {
        state = getAppState(state);
        S.view.scrollAllTop(state);

        // console.log("navHome()");
        if (state.isAnonUser) {
            S.util.loadAnonPageHome();
        } else {
            try {
                // console.log("renderNode (navHome): " + state.homeNodeId);
                const res = await S.util.ajax<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
                    nodeId: state.homeNodeId,
                    upLevel: false,
                    siblingOffset: 0,
                    renderParentIfLeaf: false,
                    forceRenderParent: false,
                    offset: 0,
                    goToLastPage: false,
                    forceIPFSRefresh: false,
                    singleNode: false,
                    parentCount: state.userPrefs.showParents ? 1 : 0
                });
                this.navPageNodeResponse(res, state);
            }
            catch (e) {
                S.nodeUtil.clearLastNodeIds();
            }
        }
    }

    navPublicHome = () => {
        S.util.loadAnonPageHome();
    }

    runSearch = (evt: Event) => {
        const id = S.util.allowIdFromEvent(evt, null);
        this.clickNodeRow(null, id);
        setTimeout(() => {
            new SearchContentDlg().open();
        }, 500);
    }

    runTimeline = (evt: Event) => {
        const id = S.util.allowIdFromEvent(evt, null);
        const state = getAppState();
        this.clickNodeRow(null, id);

        setTimeout(() => {
            const node = state.idToNodeMap.get(id);
            if (!node) {
                return;
            }
            S.srch.timeline(node, "mtm", state, null, "Rev-chron by Modify Time", 0, true);
        }, 500);
    }

    openNodeFeed = async (evt: Event, id: string) => {
        id = S.util.allowIdFromEvent(evt, id);
        const state = getAppState();

        // Try to get node from local memory...
        const node = state.idToNodeMap.get(id);
        if (node) {
            setTimeout(() => {
                if (FeedTab.inst) {
                    FeedTab.inst.props.searchTextState.setValue("");
                }

                this.messages({
                    feedFilterFriends: false,
                    feedFilterToMe: false,
                    feedFilterFromMe: false,
                    feedFilterToUser: null,
                    feedFilterToPublic: true,
                    feedFilterLocalServer: true,
                    feedFilterRootNode: node,
                    feedResults: null,
                    applyAdminBlocks: false
                });
            }, 500);
        }
        // if node not in local memory, then we have to get it from the server first...
        else {
            const res = await S.util.ajax<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
                nodeId: id,
                upLevel: false,
                siblingOffset: 0,
                renderParentIfLeaf: false,
                forceRenderParent: false,
                offset: 0,
                goToLastPage: false,
                forceIPFSRefresh: false,
                singleNode: true,
                parentCount: 0
            });

            if (!res.node) return;
            S.nodeUtil.updateNodeMap(res.node, state);
            
            if (FeedTab.inst) {
                FeedTab.inst.props.searchTextState.setValue("");
            }
            this.messages({
                feedFilterFriends: false,
                feedFilterToMe: false,
                feedFilterFromMe: false,
                feedFilterToUser: null,
                feedFilterToPublic: true,
                feedFilterLocalServer: true,
                feedFilterRootNode: res.node,
                feedResults: null,
                applyAdminBlocks: false
            });
        }
    }

    closeFullScreenViewer = (appState: AppState) => {
        dispatch("CloseFullScreenViewer", s => {
            s.fullScreenConfig = { type: FullScreenType.NONE };
            return s;
        });
    }

    prevFullScreenImgViewer = (appState: AppState) => {
        const prevNode = this.getAdjacentNode("prev", appState);

        if (prevNode) {
            dispatch("PrevFullScreenImgViewer", s => {
                s.fullScreenConfig = { type: FullScreenType.IMAGE, nodeId: prevNode.id };
                return s;
            });
        }
    }

    nextFullScreenImgViewer = (appState: AppState) => {
        const nextNode = this.getAdjacentNode("next", appState);

        if (nextNode) {
            dispatch("NextFullScreenImgViewer", s => {
                s.fullScreenConfig = { type: FullScreenType.IMAGE, nodeId: nextNode.id };
                return s;
            });
        }
    }

    // todo-2: need to make view.scrollRelativeToNode use this function instead of embedding all the same logic.
    getAdjacentNode = (dir: string, state: AppState): J.NodeInfo => {
        let newNode = null;

        // First detect if page root node is selected, before doing a child search
        if (state.fullScreenConfig.type === FullScreenType.IMAGE && //
            state.fullScreenConfig.nodeId === state.node.id) {
            return null;
        }
        else if (state.node.children && state.node.children.length > 0) {
            let prevChild: J.NodeInfo = null;
            let nodeFound = false;

            state.node.children.some((child: J.NodeInfo) => {
                let ret = false;
                const isAnAccountNode = child.ownerId && child.id === child.ownerId;

                if (S.props.hasBinary(child) && !isAnAccountNode) {

                    if (nodeFound && dir === "next") {
                        ret = true;
                        newNode = child;
                    }

                    if (state.fullScreenConfig.type === FullScreenType.IMAGE &&
                        state.fullScreenConfig.nodeId === child.id) {
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

    messages = (props: any) => {
        if (!FeedTab.inst) {
            return;
        }

        // we need to go ahead and boost the refresh counter to avoid it doing a double query.
        FeedTab.inst.props.refreshCounter++;

        dispatch("SelectTab", s => {
            s.guiReady = true;
            S.tabUtil.tabChanging(s.activeTab, C.TAB_FEED, s);
            s.activeTab = S.quanta.activeTab = C.TAB_FEED;

            // merge props parameter into the feed data props.
            FeedTab.inst.props = { ...FeedTab.inst.props, ...props };

            // console.log("feedData.props=" + S.util.prettyPrint(feedData.props));
            return s;
        });

        setTimeout(() => {
            S.srch.refreshFeed();
        }, 10);
    }

    showMyNewMessages = () => {
        this.messages({
            feedFilterFriends: false,
            feedFilterToMe: true,
            feedFilterFromMe: true,
            feedFilterToUser: null,
            feedFilterToPublic: false,
            feedFilterLocalServer: false,
            feedFilterRootNode: null,
            feedResults: null,
            applyAdminBlocks: false
        });
    }

    showPublicFediverse = () => {
        this.messages({
            feedFilterFriends: false,
            feedFilterToMe: false,
            feedFilterFromMe: false,
            feedFilterToUser: null,
            feedFilterToPublic: true,
            feedFilterLocalServer: false,
            feedFilterRootNode: null,
            feedResults: null,
            applyAdminBlocks: true
        });
    }

    showTrendingHashtags = () => {
        this.showTrendingFiltered("hashtags");
    }

    showTrendingMentions = () => {
        this.showTrendingFiltered("mentions");
    }

    showTrendingWords = () => {
        this.showTrendingFiltered("words");
    }

    showTrendingFiltered = (filter: string) => {
        if (TrendingTab.inst) {
            TrendingTab.inst.props.filter = filter;
        }

        dispatch("SelectTab", s => {
            s.guiReady = true;
            S.tabUtil.tabChanging(s.activeTab, C.TAB_TRENDING, s);
            s.activeTab = S.quanta.activeTab = C.TAB_TRENDING;

            // merge props parameter into the feed data props.
            TrendingTab.inst.props = { ...TrendingTab.inst.props };
            return s;
        });
    }

    messagesToFromMe = () => {
        if (FeedTab.inst) {
            FeedTab.inst.props.searchTextState.setValue("");
        }
        this.messages({
            feedFilterFriends: false,
            feedFilterToMe: true,
            feedFilterFromMe: true,
            feedFilterToUser: null,
            feedFilterToPublic: false,
            feedFilterLocalServer: false,
            feedFilterRootNode: null,
            feedResults: null,
            applyAdminBlocks: false
        });
    }

    messagesToMe = () => {
        if (FeedTab.inst) {
            FeedTab.inst.props.searchTextState.setValue("");
        }
        this.messages({
            feedFilterFriends: false,
            feedFilterToMe: true,
            feedFilterFromMe: false,
            feedFilterToUser: null,
            feedFilterToPublic: false,
            feedFilterLocalServer: false,
            feedFilterRootNode: null,
            feedResults: null,
            applyAdminBlocks: false
        });
    }

    messagesFromMeToUser = (user: string) => {
        if (FeedTab.inst) {
            FeedTab.inst.props.searchTextState.setValue("");
        }
        this.messages({
            feedFilterFriends: false,
            feedFilterToMe: false,
            feedFilterFromMe: false,
            // WARNING: When setting feedFilterToUser, the other filter options should be false!! They're mutually exclusive in that way.
            feedFilterToUser: user,
            feedFilterToPublic: false,
            feedFilterLocalServer: false,
            feedFilterRootNode: null,
            feedResults: null,
            applyAdminBlocks: false
        });
    }

    messagesFromMe = () => {
        if (FeedTab.inst) {
            FeedTab.inst.props.searchTextState.setValue("");
        }
        this.messages({
            feedFilterFriends: false,
            feedFilterToMe: false,
            feedFilterFromMe: true,
            feedFilterToUser: null,
            feedFilterToPublic: false,
            feedFilterLocalServer: false,
            feedFilterRootNode: null,
            feedResults: null,
            applyAdminBlocks: false
        });
    }

    messagesFromFriends = () => {
        if (FeedTab.inst) {
            FeedTab.inst.props.searchTextState.setValue("");
        }
        this.messages({
            feedFilterFriends: true,
            feedFilterToMe: false,
            feedFilterFromMe: false,
            feedFilterToUser: null,
            feedFilterToPublic: false,
            feedFilterLocalServer: false,
            feedFilterRootNode: null,
            feedResults: null,
            applyAdminBlocks: false
        });
    }

    messagesLocal = () => {
        if (FeedTab.inst) {
            FeedTab.inst.props.searchTextState.setValue("");
        }
        this.messages({
            feedFilterFriends: false,
            feedFilterToMe: false,
            feedFilterFromMe: false,
            feedFilterToUser: null,
            feedFilterToPublic: true,
            feedFilterLocalServer: true,
            feedFilterRootNode: null,
            feedResults: null,
            applyAdminBlocks: false
        });
    }

    messagesNodeFeed = (state: AppState) => {
        const hltNode = S.nodeUtil.getHighlightedNode(state);
        if (!hltNode) return;
        if (FeedTab.inst) {
            FeedTab.inst.props.searchTextState.setValue("");
        }
        this.messages({
            feedFilterFriends: false,
            feedFilterToMe: false,
            feedFilterFromMe: false,
            feedFilterToUser: null,
            feedFilterToPublic: true,
            feedFilterLocalServer: true,
            feedFilterRootNode: hltNode,
            feedResults: null,
            applyAdminBlocks: false
        });
    }

    messagesFediverse = () => {
        if (FeedTab.inst) {
            FeedTab.inst.props.searchTextState.setValue("");
        }
        this.messages({
            feedFilterFriends: false,
            feedFilterToMe: false,
            feedFilterFromMe: false,
            feedFilterToUser: null,
            feedFilterToPublic: true,
            feedFilterLocalServer: false,
            feedFilterRootNode: null,
            feedResults: null,
            applyAdminBlocks: true
        });
    }
}
