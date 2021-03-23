import { dispatch, store } from "./AppRedux";
import { AppState } from "./AppState";
import { NodeCompContent } from "./comps/NodeCompContent";
import { NodeCompRowFooter } from "./comps/NodeCompRowFooter";
import { NodeCompRowHeader } from "./comps/NodeCompRowHeader";
import { Constants as C } from "./Constants";
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

    searchNodes: any = null;
    searchText: string = null;

    searchOffset = 0;
    timelineOffset = 0;

    /*
     * Will be the last row clicked on (NodeInfo.java object) and having the red highlight bar
     */
    highlightRowNode: J.NodeInfo = null;

    idToNodeMap: Map<string, J.NodeInfo> = new Map<string, J.NodeInfo>();

    numSearchResults = (res: J.NodeSearchResponse): number => {
        return !!res && //
            !!res.searchResults && //
            !!res.searchResults.length //
            ? res.searchResults.length : 0;
    }

    searchNodesResponse = (res: J.NodeSearchResponse, searchDescription: string, isUserSearch: boolean) => {
        dispatch({
            type: "Action_RenderSearchResults",
            update: (s: AppState): AppState => {
                s.searchResults = res.searchResults;
                s.isUserSearch = isUserSearch;
                s.searchDescription = searchDescription;
                return s;
            }
        });

        S.meta64.selectTab("searchTab");
    }

    timelineResponse = (res: J.NodeSearchResponse, timelineDescription: string) => {
        dispatch({
            type: "Action_RenderTimelineResults",
            update: (s: AppState): AppState => {
                s.timelineResults = res.searchResults;
                s.timelineDescription = timelineDescription;
                return s;
            }
        });
        S.meta64.selectTab("timelineTab");
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
        }, (res) => { S.nav.navPageNodeResponse(res, state); });
    }

    /* prop = mtm (modification time) | ctm (create time) */
    timeline = (prop: string, state: AppState, timeRangeType: string, timelineDescription: string) => {
        const node = S.meta64.getHighlightedNode(state);
        if (!node) {
            S.util.showMessage("No node is selected to 'timeline' under.", "Warning");
            return;
        }

        S.util.ajax<J.NodeSearchRequest, J.NodeSearchResponse>("nodeSearch", {
            nodeId: node.id,
            searchText: "",
            sortDir: "DESC",
            sortField: prop,
            searchProp: null,
            fuzzy: false,
            caseSensitive: false,
            searchDefinition: "",
            userSearchType: null,
            timeRangeType
        }, (res) => { this.timelineResponse(res, timelineDescription); });
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
            fromFriends: appState.feedFilterFriends,
            nsfw: appState.feedFilterNSFW,
            searchText
        }, this.feedResponse);
    }

    feedResponse = (res: J.NodeFeedResponse) => {
        dispatch({
            type: "Action_RenderFeedResults",
            update: (s: AppState): AppState => {
                // s.feedResults = S.meta64.removeRedundantFeedItems(res.searchResults || []);
                s.guiReady = true;
                s.feedResults = res.searchResults;
                s.feedEndReached = res.endReached;
                s.feedDirty = false;
                s.feedLoading = false;
                s.feedWaitingForUserRefresh = false;
                return s;
            }
        });
        S.meta64.selectTab("feedTab");
        S.view.scrollToTop();
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
        // if (state.userPreferences.editMode) {
        //    clazz += " editing-border";
        // }
        // else {
        // clazz += " non-editing-border"
        // }

        if (S.render.enableRowFading && S.render.fadeInId === node.id && S.render.allowFadeInId) {
            S.render.fadeInId = null;
            S.render.allowFadeInId = false;
            clazz += " fadeInRowBkgClz";
            S.meta64.fadeStartTime = new Date().getTime();
        }

        if (isFeed) {
            if (isParent) {
                clazz += " inactive-feed-row-parent";
            }
            else {
                if (parentItem) {
                    clazz += " inactive-feed-row";
                }
            }
        }
        else {
            clazz += " inactive-row";
        }

        const div = new Div(null, {
            className: clazz,
            onClick: this.clickOnSearchResultRow,
            id: cssId,
            nid: node.id
        }, [
            new NodeCompRowHeader(node, true, isFeed, jumpButton),
            content,
            new NodeCompRowFooter(node, isFeed)
        ]);

        let itemClass = (index === count - 1) ? "userFeedItemLast" : "userFeedItem";

        return new Div(null, {
            className: isParent ? "userFeedItemParent" : itemClass
        }, [parentItem, div]);
    }

    clickOnSearchResultRow = (evt: Event, id: string) => {
        // this implementation is obsolete (update if we ever need to uncomment this)

        // DO NOT DELETE (this works, and may be needed some day)
        // There's really no reason to indicate to user what row is highlighted, so I let't just not clutter the screen for now
        // this.setRowHighlight(false);
        // this.highlightRowNode = this.idToNodeMap.get(id);
        // this.setRowHighlight(true);
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
