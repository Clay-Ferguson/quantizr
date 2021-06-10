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

    findSharedNodes = (node: J.NodeInfo, page: number, type: string, shareTarget: string, accessOption: string, state: AppState): void => {
        S.util.ajax<J.GetSharedNodesRequest, J.GetSharedNodesResponse>("getSharedNodes", {
            page,
            nodeId: node.id,
            shareTarget,
            accessOption
        }, (res) => {
            if (res.searchResults && res.searchResults.length > 0) {
                dispatch("Action_RenderSearchResults", (s: AppState): AppState => {

                    let data = s.tabData.find(d => d.id === "sharedNodesResultSetView");
                    if (!data) return;

                    data.rsInfo.results = res.searchResults;
                    data.rsInfo.page = page;
                    data.rsInfo.description = "Showing " + type + " shared nodes";
                    data.rsInfo.node = node;
                    data.rsInfo.shareTarget = shareTarget;
                    data.rsInfo.accessOption = accessOption;
                    data.rsInfo.endReached = !res.searchResults || res.searchResults.length < S.nav.ROWS_PER_PAGE;

                    S.meta64.selectTabStateOnly(data.id, s);
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
            if (res.searchResults && res.searchResults.length > 0) {
                if (successCallback) {
                    successCallback();
                }

                dispatch("Action_RenderSearchResults", (s: AppState): AppState => {

                    let data = s.tabData.find(d => d.id === "resultSetView");
                    if (!data) return;

                    data.rsInfo.results = res.searchResults;
                    data.rsInfo.page = page;
                    data.rsInfo.userSearchType = userSearchType;
                    data.rsInfo.description = description;
                    data.rsInfo.node = node;
                    data.rsInfo.searchText = searchText;
                    data.rsInfo.fuzzy = fuzzy;
                    data.rsInfo.caseSensitive = caseSensitive;
                    data.rsInfo.prop = prop;
                    data.rsInfo.endReached = !res.searchResults || res.searchResults.length < S.nav.ROWS_PER_PAGE;

                    S.meta64.selectTabStateOnly(data.id, s);
                    return s;
                });
            }
            else {
                new MessageDlg("No search results found.", "Search", null, null, false, 0, state).open();
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

    /* prop = mtm (modification time) | ctm (create time) */
    timeline = (node: J.NodeInfo, prop: string, state: AppState, timeRangeType: string, timelineDescription: string, page: number) => {

        /* this code AND other similar code needs a way to lockin the node, here so it can't change during pagination
        including when the page==0 because user is just jumping to beginning. Need a specific param for saying
        it's ok to reset node or not */
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

                let data = s.tabData.find(d => d.id === "timelineResultSetView");
                if (!data) return;

                data.rsInfo.results = res.searchResults;
                data.rsInfo.description = timelineDescription;
                data.rsInfo.prop = prop;
                data.rsInfo.timeRangeType = timeRangeType;
                data.rsInfo.node = node;
                data.rsInfo.endReached = !res.searchResults || res.searchResults.length < S.nav.ROWS_PER_PAGE;
                data.rsInfo.page = page;

                S.meta64.selectTabStateOnly(data.id, s);
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

    showFollowers = (page: number, userName: string): void => {
        let state: AppState = store.getState();
        if (state.isAnonUser || state.isAdminUser) return;

        if (!userName) {
            userName = state.userName;
        }

        S.util.ajax<J.GetFollowersRequest, J.GetFollowersResponse>("getFollowers", {
            page,
            targetUserName: userName
        }, (res) => {
            if (res.searchResults && res.searchResults.length > 0) {
                dispatch("Action_RenderSearchResults", (s: AppState): AppState => {
                    let data = s.tabData.find(d => d.id === "followersResultSetView");
                    if (!data) return;

                    data.rsInfo.results = res.searchResults;
                    data.rsInfo.page = page;
                    data.rsInfo.userSearchType = "followers";
                    data.rsInfo.description = null;
                    data.rsInfo.node = null;
                    data.rsInfo.searchText = null;
                    data.rsInfo.fuzzy = false;
                    data.rsInfo.caseSensitive = false;
                    data.rsInfo.prop = null;
                    data.rsInfo.endReached = !res.searchResults || res.searchResults.length < S.nav.ROWS_PER_PAGE;

                    // well be showing who the followers of userName are
                    data.rsInfo.showingFollowersOfUser = userName;
                    S.meta64.selectTabStateOnly(data.id, s);
                    return s;
                });
            }
            else {
                new MessageDlg("No search results found.", "Followers", null, null, false, 0, state).open();
            }
        });
    }

    showFollowing = (page: number, userName: string): void => {
        let state: AppState = store.getState();
        if (state.isAnonUser || state.isAdminUser) return;

        if (!userName) {
            userName = state.userName;
        }

        S.util.ajax<J.GetFollowingRequest, J.GetFollowingResponse>("getFollowing", {
            page,
            targetUserName: userName
        }, (res) => {
            if (res.searchResults && res.searchResults.length > 0) {
                dispatch("Action_RenderSearchResults", (s: AppState): AppState => {
                    let data = s.tabData.find(d => d.id === "followingResultSetView");
                    if (!data) return;

                    data.rsInfo.results = res.searchResults;
                    data.rsInfo.page = page;
                    data.rsInfo.userSearchType = "following";
                    data.rsInfo.description = null;
                    data.rsInfo.node = null;
                    data.rsInfo.searchText = null;
                    data.rsInfo.fuzzy = false;
                    data.rsInfo.caseSensitive = false;
                    data.rsInfo.prop = null;
                    data.rsInfo.endReached = !res.searchResults || res.searchResults.length < S.nav.ROWS_PER_PAGE;

                    // we'll be showig who userName is following here.
                    data.rsInfo.showingFollowingOfUser = userName;
                    S.meta64.selectTabStateOnly(data.id, s);
                    return s;
                });
            }
            else {
                new MessageDlg("No search results found.", "Following", null, null, false, 0, state).open();
            }
        });
    }

    /*
     * Renders a single line of search results on the search results page.
     */
    renderSearchResultAsListItem = (node: J.NodeInfo, index: number, count: number, rowCount: number, prefix: string,
        isFeed: boolean, isParent: boolean, allowAvatars: boolean, jumpButton: boolean, allowHeader: boolean, allowFooter: boolean, state: AppState): Comp => {
        if (!node) return;

        /* If there's a parent on this node it's a 'feed' item and this parent is what the user was replyig to so we display it just above the
        item we are rendering */
        let parentItem: Comp = null;
        if (node.parent) {
            parentItem = this.renderSearchResultAsListItem(node.parent, index, count, rowCount, prefix, isFeed, true, allowAvatars, jumpButton, allowHeader, allowFooter, state);
        }

        const cssId = this._UID_ROWID_PREFIX + node.id;
        const content = new NodeCompContent(node, true, true, prefix, true, null, false);

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
            allowHeader ? new NodeCompRowHeader(node, true, false, isFeed, jumpButton) : null,
            content,
            allowFooter ? new NodeCompRowFooter(node, isFeed) : null
        ]);

        let itemClass = "userFeedItem"; // (index === count - 1) ? "userFeedItemLast" : "userFeedItem";

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
