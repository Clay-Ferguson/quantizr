import { dispatch, getAppState, promiseDispatch } from "./AppContext";
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
import { MainTab } from "./tabs/data/MainTab";
import { TrendingTab } from "./tabs/data/TrendingTab";

export class Nav {
    _UID_ROWID_PREFIX: string = "row_";

    displayingRepositoryRoot = (ast: AppState): boolean => {
        if (!ast.node) return false;
        // one way to detect repository root (without path, since we don't send paths back to client) is as the only node that owns itself.
        return ast.node.id === ast.node.ownerId;
    }

    displayingHome = (ast: AppState): boolean => {
        if (!ast.node) return false;
        if (ast.isAnonUser) {
            return ast.node.id === ast.anonUserLandingPageNode;
        } else {
            return ast.node.id === ast.userProfile?.homeNodeId;
        }
    }

    parentVisibleToUser = (ast: AppState): boolean => {
        return !this.displayingHome(ast);
    }

    upLevelResponse = (res: J.RenderNodeResponse, id: string, scrollToTop: boolean, ast: AppState) => {
        if (!res || !res.node || res.errorType === J.ErrorType.AUTH) {
            S.util.showPageMessage("The node above is not shared.");
        } else {
            S.render.renderPage(res, scrollToTop, id, true, true);
        }
    }

    navOpenSelectedNode = (ast: AppState) => {
        const selNode = S.nodeUtil.getHighlightedNode(ast);
        if (!selNode) return;
        if (C.DEBUG_SCROLLING) {
            console.log("navOpenSelectedNode");
        }
        this.openNodeById(null, selNode.id, ast);
    }

    navToPrev = () => {
        this.navToSibling(-1);
    }

    navToNext = () => {
        this.navToSibling(1);
    }

    navToSibling = async (siblingOffset: number, state?: AppState): Promise<string> => {
        state = getAppState(state);
        if (!state.node) return null;

        try {
            const res = await S.rpcUtil.rpc<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
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
        }
    }

    navUpLevelClick = async (evt: Event = null, id: string = null) => {
        // for state management, especially for scrolling, we need to run the node click on the node
        // before upLeveling from it.
        await this.clickTreeNode(evt, id);
        this.navUpLevel(false);
    }

    navUpLevel = async (processingDelete: boolean): Promise<void> => {
        const ast = getAppState();
        if (!ast.node) return null;

        if (!this.parentVisibleToUser(ast)) {
            S.util.showMessage("The parent of this node isn't shared to you.", "Warning");
            // Already at root. Can't go up.
            return;
        }

        try {
            const res = await S.rpcUtil.rpc<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
                nodeId: ast.node.id,
                upLevel: true,
                siblingOffset: 0,
                renderParentIfLeaf: false,
                forceRenderParent: false,
                offset: 0,
                goToLastPage: false,
                forceIPFSRefresh: false,
                singleNode: false,
                parentCount: ast.userPrefs.showParents ? 1 : 0
            });

            if (processingDelete) {
                S.quanta.refresh(ast);
            }
            else {
                this.upLevelResponse(res, ast.node.id, false, ast);
            }
        }
        catch (e) {
            S.nodeUtil.clearLastNodeIds();
        }
    }

    /* NOTE: Elements that have this as an onClick method must have the nodeId
    on an attribute of the element */
    clickTreeNode = async (evt: Event, id: string, state?: AppState) => {
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

            /*
             * sets which node is selected on this page (i.e. parent node of this page being the 'key')
             */
            const node = MainTab.inst?.findNode(state, id);
            if (node) {
                dispatch("HighlightNode", s => {
                    S.nodeUtil.highlightNode(node, false, s);
                });
            }
            else {
                console.error("Node not found: " + id);
            }
            S.domUtil.focusId(C.TAB_MAIN);
            resolve();
        });
    }

    openContentNode = async (nodePathOrId: string, ast: AppState = null) => {
        ast = getAppState(ast);

        try {
            const res = await S.rpcUtil.rpc<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
                nodeId: nodePathOrId,
                upLevel: false,
                siblingOffset: 0,
                renderParentIfLeaf: null,
                forceRenderParent: false,
                offset: 0,
                goToLastPage: false,
                forceIPFSRefresh: false,
                singleNode: false,
                parentCount: ast.userPrefs.showParents ? 1 : 0
            });

            this.navPageNodeResponse(res, ast);
        }
        catch (e) {
            S.nodeUtil.clearLastNodeIds();
        }
    }

    openNodeById = (evt: Event, id: string, ast: AppState) => {
        id = S.util.allowIdFromEvent(evt, id);
        ast = getAppState(ast);
        const node = MainTab.inst?.findNode(ast, id);

        if (!node) {
            S.util.showMessage("Unknown nodeId in openNodeByUid: " + id, "Warning");
        } else {
            if (C.DEBUG_SCROLLING) {
                console.log("openNodeById");
            }
            S.nodeUtil.highlightNode(node, false, ast);
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
                ast
            });
        }
    }

    setNodeSel = (selected: boolean, id: string, ast: AppState) => {
        if (!id) return;
        ast = getAppState(ast);
        if (selected) {
            ast.selectedNodes.add(id);
        } else {
            ast.selectedNodes.delete(id);
        }
    }

    navPageNodeResponse = (res: J.RenderNodeResponse, ast: AppState) => {
        S.render.renderPage(res, true, null, true, true);
        S.tabUtil.selectTab(C.TAB_MAIN);
    }

    geoLocation = (ast: AppState) => {
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

    showMainMenu = (ast: AppState) => {
        S.quanta.mainMenu = new MainMenuDlg();
        S.quanta.mainMenu.open();
    }

    navToMyAccntRoot = async (ast: AppState = null) => {
        ast = getAppState(ast);
        S.view.scrollActiveToTop(ast);

        if (ast.isAnonUser) {
            S.util.loadAnonPageHome();
        } else {
            try {
                const res = await S.rpcUtil.rpc<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
                    nodeId: ast.userProfile?.userNodeId,
                    upLevel: false,
                    siblingOffset: 0,
                    renderParentIfLeaf: false,
                    forceRenderParent: false,
                    offset: 0,
                    goToLastPage: false,
                    forceIPFSRefresh: false,
                    singleNode: false,
                    parentCount: ast.userPrefs.showParents ? 1 : 0
                });

                this.navPageNodeResponse(res, ast);
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
        this.clickTreeNode(null, id);
        setTimeout(() => {
            new SearchContentDlg().open();
        }, 250);
    }

    openDocumentView = (evt: Event, id: string) => {
        id = S.util.allowIdFromEvent(evt, id);
        const ast = getAppState();

        setTimeout(async () => {
            let node = MainTab.inst?.findNode(ast, id);

            // if we don't have this node locally on our tree, get it from the server.
            if (!node) {
                const res = await S.rpcUtil.rpc<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
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
                if (!res.node) {
                    // todo-1: in this code path we should show an error message ON the Document Tab.
                    return;
                }
                node = res.node;
            }
            S.srch.showDocument(node, false, ast);
        }, 250);
    }

    runTimeline = (evt: Event) => {
        const id = S.util.allowIdFromEvent(evt, null);
        const ast = getAppState();
        this.clickTreeNode(null, id);

        setTimeout(() => {
            const node = MainTab.inst?.findNode(ast, id);
            if (!node) {
                return;
            }
            S.srch.timeline(node, "mtm", ast, null, "Rev-chron by Modify Time", 0, true);
        }, 250);
    }

    openNodeFeed = async (evt: Event, id: string) => {
        id = S.util.allowIdFromEvent(evt, id);
        const ast = getAppState();
        const node = MainTab.inst?.findNode(ast, id);
        if (node) {
            setTimeout(() => {
                if (FeedTab.inst) {
                    FeedTab.inst.props.searchTextState.setValue("");
                }

                this.messages({
                    feedFilterFriends: false,
                    feedFilterToMe: false,
                    feedFilterMyMentions: false,
                    feedFilterFromMe: false,
                    feedFilterToUser: null,
                    feedFilterToPublic: true,
                    feedFilterLocalServer: true,
                    feedFilterRootNode: node,
                    feedResults: null,
                    applyAdminBlocks: false,
                    name: J.Constant.FEED_PUB
                });
            }, 250);
        }
        // if node not in local memory, then we have to get it from the server first...
        else {
            const res = await S.rpcUtil.rpc<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
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

            if (FeedTab.inst) {
                FeedTab.inst.props.searchTextState.setValue("");
            }
            this.messages({
                feedFilterFriends: false,
                feedFilterToMe: false,
                feedFilterMyMentions: false,
                feedFilterFromMe: false,
                feedFilterToUser: null,
                feedFilterToPublic: true,
                feedFilterLocalServer: true,
                feedFilterRootNode: res.node,
                feedResults: null,
                applyAdminBlocks: false,
                name: J.Constant.FEED_PUB
            });
        }
    }

    closeFullScreenViewer = (ast: AppState) => {
        dispatch("CloseFullScreenViewer", s => {
            s.fullScreenConfig = { type: FullScreenType.NONE };
            s.graphData = null;
        });
    }

    prevFullScreenImgViewer = (ast: AppState) => {
        const node = S.nodeUtil.findNode(ast, ast.fullScreenConfig.nodeId);
        if (node && node.attachments) {
            const list: J.Attachment[] = S.props.getOrderedAttachments(node);
            let selAtt: J.Attachment = list[0];
            let lastAtt: J.Attachment = null;
            list.forEach(att => {
                if (att.o === ast.fullScreenConfig.ordinal) {
                    selAtt = lastAtt;
                }
                lastAtt = att;
            });

            dispatch("PrevFullScreenImgViewer", s => {
                s.fullScreenConfig.ordinal = selAtt.o;
            });
        }
    }

    nextFullScreenImgViewer = (ast: AppState) => {
        const node = S.nodeUtil.findNode(ast, ast.fullScreenConfig.nodeId);
        if (node && node.attachments) {
            const list: J.Attachment[] = S.props.getOrderedAttachments(node);
            let selAtt: J.Attachment = list[list.length - 1];
            let takeNext = false;
            list.forEach(att => {
                if (takeNext) {
                    selAtt = att;
                    takeNext = false;
                }
                if (att.o === ast.fullScreenConfig.ordinal) {
                    takeNext = true;
                }
            });

            dispatch("PrevFullScreenImgViewer", s => {
                s.fullScreenConfig.ordinal = selAtt.o;
            });
        }
    }

    messages = async (props: any) => {
        if (!FeedTab.inst) {
            return;
        }

        // we need to go ahead and boost the refresh counter to avoid it doing a double query.
        FeedTab.inst.props.refreshCounter++;

        await promiseDispatch("SelectTab", s => {
            S.tabUtil.tabChanging(s.activeTab, C.TAB_FEED, s);
            s.activeTab = S.quanta.activeTab = C.TAB_FEED;

            // merge props parameter into the feed data props.
            FeedTab.inst.props = { ...FeedTab.inst.props, ...props };
        });

        setTimeout(() => {
            S.srch.refreshFeed();
        }, 10);
    }

    showMyNewMessages = () => {
        this.messages({
            feedFilterFriends: false,
            feedFilterToMe: true,
            feedFilterMyMentions: false,
            feedFilterFromMe: true,
            feedFilterToUser: null,
            feedFilterToPublic: false,
            feedFilterLocalServer: false,
            feedFilterRootNode: null,
            feedResults: null,
            applyAdminBlocks: false,
            name: J.Constant.FEED_NEW
        });
    }

    showPublicFediverse = () => {
        this.messages({
            feedFilterFriends: false,
            feedFilterToMe: false,
            feedFilterMyMentions: false,
            feedFilterFromMe: false,
            feedFilterToUser: null,
            feedFilterToPublic: true,
            feedFilterLocalServer: false,
            feedFilterRootNode: null,
            feedResults: null,
            applyAdminBlocks: true,
            name: J.Constant.FEED_PUB
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
            S.tabUtil.tabChanging(s.activeTab, C.TAB_TRENDING, s);
            s.activeTab = S.quanta.activeTab = C.TAB_TRENDING;

            // merge props parameter into the feed data props.
            TrendingTab.inst.props = { ...TrendingTab.inst.props };
        });
    }

    messagesToFromMe = () => {
        if (FeedTab.inst) {
            FeedTab.inst.props.searchTextState.setValue("");
        }
        this.messages({
            feedFilterFriends: false,
            feedFilterToMe: true,
            feedFilterMyMentions: false,
            feedFilterFromMe: true,
            feedFilterToUser: null,
            feedFilterToPublic: false,
            feedFilterLocalServer: false,
            feedFilterRootNode: null,
            feedResults: null,
            applyAdminBlocks: false,
            name: J.Constant.FEED_TOFROMME
        });
    }

    messagesMyMentions = () => {
        if (FeedTab.inst) {
            FeedTab.inst.props.searchTextState.setValue("");
        }
        this.messages({
            feedFilterFriends: false,
            feedFilterMyMentions: true,
            feedFilterToMe: false,
            feedFilterFromMe: false,
            feedFilterToUser: null,
            feedFilterToPublic: false,
            feedFilterLocalServer: false,
            feedFilterRootNode: null,
            feedResults: null,
            applyAdminBlocks: false,
            name: J.Constant.FEED_MY_MENTIONS
        });
    }

    messagesToMe = () => {
        if (FeedTab.inst) {
            FeedTab.inst.props.searchTextState.setValue("");
        }
        this.messages({
            feedFilterFriends: false,
            feedFilterToMe: true,
            feedFilterMyMentions: false,
            feedFilterFromMe: false,
            feedFilterToUser: null,
            feedFilterToPublic: false,
            feedFilterLocalServer: false,
            feedFilterRootNode: null,
            feedResults: null,
            applyAdminBlocks: false,
            name: J.Constant.FEED_TOME
        });
    }

    messagesFromMeToUser = (user: string) => {
        if (FeedTab.inst) {
            FeedTab.inst.props.searchTextState.setValue("");
        }
        this.messages({
            feedFilterFriends: false,
            feedFilterToMe: false,
            feedFilterMyMentions: false,
            feedFilterFromMe: false,
            // WARNING: When setting feedFilterToUser, the other filter options should be false!! They're mutually exclusive in that way.
            feedFilterToUser: user,
            feedFilterToPublic: false,
            feedFilterLocalServer: false,
            feedFilterRootNode: null,
            feedResults: null,
            applyAdminBlocks: false,
            name: J.Constant.FEED_FROMMETOUSER
        });
    }

    messagesFromMe = () => {
        if (FeedTab.inst) {
            FeedTab.inst.props.searchTextState.setValue("");
        }
        this.messages({
            feedFilterFriends: false,
            feedFilterToMe: false,
            feedFilterMyMentions: false,
            feedFilterFromMe: true,
            feedFilterToUser: null,
            feedFilterToPublic: false,
            feedFilterLocalServer: false,
            feedFilterRootNode: null,
            feedResults: null,
            applyAdminBlocks: false,
            name: J.Constant.FEED_FROMME
        });
    }

    // WARNING: This is not "myMentions!" It's for any arbitary user!
    messagesFindMentions = (userName: string) => {
        // expand so users can see what's going on with the search string and know they can clear it.
        // If feed tab exists, expand the filter part
        if (FeedTab.inst) {
            FeedTab.inst.props.searchTextState.setValue("@" + userName);
        }

        S.nav.messages({
            feedFilterFriends: false,
            feedFilterToMe: false,
            feedFilterMyMentions: false,
            feedFilterFromMe: false,
            feedFilterToUser: null,
            feedFilterToPublic: true,
            feedFilterLocalServer: false,
            feedFilterRootNode: null,
            feedResults: null,
            applyAdminBlocks: false,
            name: J.Constant.FEED_PUB
        });
    }

    messagesFromFriends = () => {
        if (FeedTab.inst) {
            FeedTab.inst.props.searchTextState.setValue("");
        }

        this.messages({
            feedFilterFriends: true,
            feedFilterToMe: false,
            feedFilterMyMentions: false,
            feedFilterFromMe: false,
            feedFilterToUser: null,
            feedFilterToPublic: false,
            feedFilterLocalServer: false,
            feedFilterRootNode: null,
            feedResults: null,
            applyAdminBlocks: false,
            name: J.Constant.FEED_FROMFRIENDS
        });
    }

    messagesLocal = () => {
        if (FeedTab.inst) {
            FeedTab.inst.props.searchTextState.setValue("");
        }
        this.messages({
            feedFilterFriends: false,
            feedFilterToMe: false,
            feedFilterMyMentions: false,
            feedFilterFromMe: false,
            feedFilterToUser: null,
            feedFilterToPublic: true,
            feedFilterLocalServer: true,
            feedFilterRootNode: null,
            feedResults: null,
            applyAdminBlocks: false,
            name: J.Constant.FEED_LOCAL
        });
    }

    messagesNodeFeed = (ast: AppState) => {
        const hltNode = S.nodeUtil.getHighlightedNode(ast);
        if (!hltNode) return;
        if (FeedTab.inst) {
            FeedTab.inst.props.searchTextState.setValue("");
        }
        this.messages({
            feedFilterFriends: false,
            feedFilterToMe: false,
            feedFilterMyMentions: false,
            feedFilterFromMe: false,
            feedFilterToUser: null,
            feedFilterToPublic: true,
            feedFilterLocalServer: true,
            feedFilterRootNode: hltNode,
            feedResults: null,
            applyAdminBlocks: false,
            name: J.Constant.FEED_NODEFEED
        });
    }

    messagesFediverse = () => {
        if (FeedTab.inst) {
            FeedTab.inst.props.searchTextState.setValue("");
        }
        this.messages({
            feedFilterFriends: false,
            feedFilterToMe: false,
            feedFilterMyMentions: false,
            feedFilterFromMe: false,
            feedFilterToUser: null,
            feedFilterToPublic: true,
            feedFilterLocalServer: false,
            feedFilterRootNode: null,
            feedResults: null,
            applyAdminBlocks: true,
            name: J.Constant.FEED_PUB
        });
    }
}
