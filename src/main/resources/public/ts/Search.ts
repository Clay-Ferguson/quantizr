import { dispatch, store } from "./AppRedux";
import { AppState } from "./AppState";
import { NodeCompContent } from "./comps/NodeCompContent";
import { NodeCompRowFooter } from "./comps/NodeCompRowFooter";
import { NodeCompRowHeader } from "./comps/NodeCompRowHeader";
import { Constants as C } from "./Constants";
import { MessageDlg } from "./dlg/MessageDlg";
import { SearchIntf } from "./intf/SearchIntf";
import * as J from "./JavaIntf";
import { PubSub } from "./PubSub";
import { Singletons } from "./Singletons";
import { Comp } from "./widget/base/Comp";
import { Div } from "./widget/Div";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class Search implements SearchIntf {

    _UID_ROWID_PREFIX: string = "srch_row_";

    /*
     * Will be the last row clicked on (NodeInfo.java object) and having the red highlight bar
     */
    highlightRowNode: J.NodeInfo = null;
    idToNodeMap: Map<string, J.NodeInfo> = new Map<string, J.NodeInfo>();

    numSearchResults = (results: J.NodeInfo[]): number => {
        return results ? results.length : 0;
    }

    searchPageChange = (state: AppState, pageDelta: number): void => {
        switch (state.searchInfo.searchType) {
            case "normalSearch":
                this.search(state.searchInfo.node,
                    state.searchInfo.prop,
                    state.searchInfo.searchText,
                    state,
                    state.searchInfo.userSearchType,
                    state.searchInfo.description,
                    state.searchInfo.fuzzy,
                    state.searchInfo.caseSensitive,
                    pageDelta === 0 ? 0 : state.searchInfo.page + pageDelta,
                    null);
                break;

            case "findSharedNodes":
                this.findSharedNodes(state.searchInfo.node,
                    pageDelta === 0 ? 0 : state.searchInfo.page + pageDelta,
                    state.searchInfo.shareNodesType,
                    state.searchInfo.shareTarget,
                    state.searchInfo.accessOption,
                    state);
                break;

            default: break;
        }
    }

    findSharedNodes = (node: J.NodeInfo, page: number, type: string, shareTarget: string, accessOption: string, state: AppState): void => {
        S.util.ajax<J.GetSharedNodesRequest, J.GetSharedNodesResponse>("getSharedNodes", {
            page,
            nodeId: node.id,
            shareTarget,
            accessOption
        }, (res) => {
            if (this.numSearchResults(res.searchResults) > 0) {
                dispatch("Action_RenderSearchResults", (s: AppState): AppState => {
                    s.searchInfo.searchType = "findSharedNodes";
                    s.searchInfo.results = res.searchResults;
                    s.searchInfo.page = page;
                    s.searchInfo.description = "Showing " + type + " shared nodes";
                    s.searchInfo.node = node;
                    s.searchInfo.shareTarget = shareTarget;
                    s.searchInfo.accessOption = accessOption;
                    s.searchInfo.endReached = !res.searchResults || res.searchResults.length < S.nav.ROWS_PER_PAGE;
                    S.meta64.selectTabStateOnly("searchTab", s);
                    return s;
                });
            }
            else {
                new MessageDlg("No search results found for " + type + " shared nodes", "Search", null, null, false, 0, state).open();
            }
        });
    }

    search = (node: J.NodeInfo, prop: string, searchText: string, state: AppState, userSearchType: string, description: string, fuzzy: boolean, caseSensitive: boolean, page: number, successCallback: Function): void => {
        if (!node) {
            node = S.meta64.getHighlightedNode(state);
        }

        S.util.ajax<J.NodeSearchRequest, J.NodeSearchResponse>("nodeSearch", {
            page,
            nodeId: node.id,
            searchText,
            sortDir: "DESC",
            sortField: "mtm",
            searchProp: prop,
            fuzzy,
            caseSensitive,
            userSearchType,
            searchDefinition: "",
            timeRangeType: null
        }, (res) => {
            if (this.numSearchResults(res.searchResults) > 0) {
                if (successCallback) {
                    successCallback();
                }

                dispatch("Action_RenderSearchResults", (s: AppState): AppState => {
                    s.searchInfo.searchType = "normalSearch";
                    s.searchInfo.results = res.searchResults;
                    s.searchInfo.page = page;
                    s.searchInfo.userSearchType = userSearchType;
                    s.searchInfo.description = description;
                    s.searchInfo.node = node;
                    s.searchInfo.searchText = searchText;
                    s.searchInfo.fuzzy = fuzzy;
                    s.searchInfo.caseSensitive = caseSensitive;
                    s.searchInfo.prop = prop;
                    s.searchInfo.endReached = !res.searchResults || res.searchResults.length < S.nav.ROWS_PER_PAGE;

                    S.meta64.selectTabStateOnly("searchTab", s);
                    return s;
                });
            }
            else {
                if (successCallback) {
                    new MessageDlg("No search results found.", "Search", null, null, false, 0, state).open();
                }
            }
        });
    }

    searchFilesResponse = (res: J.FileSearchResponse, state: AppState) => {
        S.util.ajax<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
            nodeId: res.searchResultNodeId,
            upLevel: false,
            siblingOffset: 0,
            renderParentIfLeaf: null,
            offset: 0,
            goToLastPage: false,
            forceIPFSRefresh: false,
            singleNode: false
        }, (res) => S.nav.navPageNodeResponse(res, state));
    }

    timelinePageChange = (state: AppState, pageDelta: number) => {
        this.timeline(state.timelineInfo.node, state.timelineInfo.prop, state, state.timelineInfo.timeRangeType,
            state.timelineInfo.description,
            pageDelta === 0 ? 0 : state.timelineInfo.page + pageDelta);
    }

    /* prop = mtm (modification time) | ctm (create time) */
    timeline = (node: J.NodeInfo, prop: string, state: AppState, timeRangeType: string, timelineDescription: string, page: number) => {
        if (!node) {
            node = S.meta64.getHighlightedNode(state);
        }

        if (!node) {
            S.util.showMessage("No node is selected to 'timeline' under.", "Warning");
            return;
        }

        S.util.ajax<J.NodeSearchRequest, J.NodeSearchResponse>("nodeSearch", {
            page,
            nodeId: node.id,
            searchText: "",
            sortDir: "DESC",
            sortField: prop,
            searchProp: null,
            fuzzy: false,
            caseSensitive: false,
            searchDefinition: "timeline",
            userSearchType: null,
            timeRangeType
        }, (res) => {
            dispatch("Action_RenderTimelineResults", (s: AppState): AppState => {
                s.timelineInfo.results = res.searchResults;
                s.timelineInfo.description = timelineDescription;
                s.timelineInfo.prop = prop;
                s.timelineInfo.timeRangeType = timeRangeType;
                s.timelineInfo.node = node;
                s.timelineInfo.endReached = !res.searchResults || res.searchResults.length < S.nav.ROWS_PER_PAGE;
                s.timelineInfo.page = page;

                S.meta64.selectTabStateOnly("timelineTab", s);
                return s;
            });
        });
    }

    feed = (nodeId: string, feedUserName: string, page: number, searchText: string) => {
        let appState = store.getState();
        S.util.ajax<J.NodeFeedRequest, J.NodeFeedResponse>("nodeFeed", {
            page,
            nodeId,
            feedUserName,
            toMe: appState.feedFilterToMe,
            fromMe: appState.feedFilterFromMe,
            toPublic: appState.feedFilterToPublic,
            localOnly: appState.feedFilterLocalServer,
            fromFriends: appState.feedFilterFriends,
            nsfw: appState.feedFilterNSFW,
            searchText
        }, this.feedResponse);
    }

    feedResponse = (res: J.NodeFeedResponse) => {
        dispatch("Action_RenderFeedResults", (s: AppState): AppState => {
            // s.feedResults = S.meta64.removeRedundantFeedItems(res.searchResults || []);

            // once user requests their stuff, turn off the new messages count indicator.
            if (s.feedFilterToMe) {
                s.newMessageCount = 0;
            }

            s.guiReady = true;
            s.feedResults = res.searchResults;
            s.feedEndReached = res.endReached;
            s.feedDirty = false;
            s.feedLoading = false;
            s.feedWaitingForUserRefresh = false;
            S.meta64.selectTabStateOnly("feedTab", s);
            S.view.scrollToTop();
            return s;
        });
    }

    initSearchNode = (node: J.NodeInfo) => {
        if (!node) return;
        this.idToNodeMap.set(node.id, node);

        // NOTE: only the getFeed call (Feed tab) will have items with some parents populated.
        if (node.parent) {
            this.idToNodeMap.set(node.parent.id, node.parent);
        }
    }

    /*
     * Renders a single line of search results on the search results page.
     */
    renderSearchResultAsListItem = (node: J.NodeInfo, index: number, count: number, rowCount: number, prefix: string, isFeed: boolean, isParent: boolean, allowAvatars: boolean, jumpButton: boolean, state: AppState): Comp => {
        if (!node) return;

        /* If there's a parent on this node it's a 'feed' item and this parent is what the user was replyig to so we display it just above the
        item we are rendering */
        let parentItem: Comp = null;
        if (node.parent) {
            parentItem = this.renderSearchResultAsListItem(node.parent, index, count, rowCount, prefix, isFeed, true, allowAvatars, jumpButton, state);
        }

        const cssId = this._UID_ROWID_PREFIX + node.id;
        const content = new NodeCompContent(node, true, true, prefix, true, null);

        let clazz = isFeed ? "feed-node-table-row" : "node-table-row";
        if (S.render.enableRowFading && S.render.fadeInId === node.id && S.render.allowFadeInId) {
            S.render.fadeInId = null;
            S.render.allowFadeInId = false;
            clazz += " fadeInRowBkgClz";
            S.meta64.fadeStartTime = new Date().getTime();
        }

        if (isParent) {
            clazz += " inactive-feed-row-parent";
        }
        else {
            if (parentItem) {
                clazz += " inactive-feed-row";
            }
        }

        const div = new Div(null, {
            className: clazz,
            id: cssId,
            nid: node.id
        }, [
            new NodeCompRowHeader(node, true, false, isFeed, jumpButton),
            content,
            new NodeCompRowFooter(node, isFeed)
        ]);

        let itemClass = (index === count - 1) ? "userFeedItemLast" : "userFeedItem";

        return new Div(null, {
            className: isParent ? "userFeedItemParent" : itemClass
        }, [parentItem, div]);
    }

    clickSearchNode = (id: string, state: AppState) => {
        /*
         * update highlight node to point to the node clicked on, just to persist it for later
         */
        this.highlightRowNode = this.idToNodeMap.get(id);
        if (!this.highlightRowNode) {
            throw new Error("Unable to find uid in search results: " + id);
        }

        S.view.refreshTree(this.highlightRowNode.id, true, true, this.highlightRowNode.id, false, true, true, state);
    }

    searchAndReplace = (recursive: boolean, nodeId: string, search: string, replace: string, state: AppState): void => {
        S.util.ajax<J.SearchAndReplaceRequest, J.SearchAndReplaceResponse>("searchAndReplace", {
            recursive,
            nodeId,
            search,
            replace
        }, (res: J.SearchAndReplaceResponse) => {
            S.view.refreshTree(null, false, false, null, false, true, true, state);
            S.util.showMessage(res.message, "Success");
        });
    }
}
