import { appState, dispatch, store } from "./AppRedux";
import { AppState } from "./AppState";
import { NodeCompContent } from "./comp/node/NodeCompContent";
import { NodeCompRowFooter } from "./comp/node/NodeCompRowFooter";
import { NodeCompRowHeader } from "./comp/node/NodeCompRowHeader";
import { Constants as C } from "./Constants";
import { MessageDlg } from "./dlg/MessageDlg";
import { FollowersRSInfo } from "./FollowersRSInfo";
import { FollowingRSInfo } from "./FollowingRSInfo";
import { TabDataIntf } from "./intf/TabDataIntf";
import * as J from "./JavaIntf";
import { PubSub } from "./PubSub";
import { SharesRSInfo } from "./SharesRSInfo";
import { Singletons } from "./Singletons";
import { TimelineRSInfo } from "./TimelineRSInfo";
import { Comp } from "./comp/base/Comp";
import { Div } from "./comp/Div";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class Search {
    _UID_ROWID_PREFIX: string = "srch_row_";

    idToNodeMap: Map<string, J.NodeInfo> = new Map<string, J.NodeInfo>();

    findSharedNodes = async (node: J.NodeInfo, page: number, type: string, shareTarget: string, accessOption: string, state: AppState): Promise<void> => {
        let res: J.GetSharedNodesResponse = await S.util.ajax<J.GetSharedNodesRequest, J.GetSharedNodesResponse>("getSharedNodes", {
            page,
            nodeId: node.id,
            shareTarget,
            accessOption
        });
        if (res.searchResults?.length > 0) {
            dispatch("Action_RenderSearchResults", (s: AppState): AppState => {
                S.domUtil.focusId(C.TAB_SHARES);
                S.tabUtil.tabScrollTop(s, C.TAB_SHARES);
                let data = s.tabData.find(d => d.id === C.TAB_SHARES);
                if (!data) return;
                let info = data.rsInfo as SharesRSInfo;

                info.results = res.searchResults;
                info.page = page;
                info.description = "Showing " + type + " shared nodes";
                info.node = node;
                info.shareTarget = shareTarget;
                info.accessOption = accessOption;
                info.endReached = !res.searchResults || res.searchResults.length < J.ConstantInt.ROWS_PER_PAGE;

                S.tabUtil.selectTabStateOnly(data.id, s);
                return s;
            });
        }
        else {
            new MessageDlg("No search results found for " + type + " shared nodes", "Search", null, null, false, 0, null, state).open();
        }
    }

    search = async (node: J.NodeInfo, prop: string, searchText: string, state: AppState, searchType: string, description: string, fuzzy: boolean, caseSensitive: boolean, page: number, recursive: boolean, sortField: string, sortDir: string, requirePriority: boolean, successCallback: Function): Promise<void> => {
        let res: J.NodeSearchResponse = await S.util.ajax<J.NodeSearchRequest, J.NodeSearchResponse>("nodeSearch", {
            page,
            nodeId: node ? node.id : null, // for user searchTypes this node can be null
            searchText,
            sortDir,
            sortField,
            searchProp: prop,
            fuzzy,
            caseSensitive,
            searchType,
            searchDefinition: "",
            timeRangeType: null,
            recursive,
            requirePriority
        });

        if (res.searchResults && res.searchResults.length > 0) {
            if (successCallback) {
                successCallback();
            }

            dispatch("Action_RenderSearchResults", (s: AppState): AppState => {
                S.domUtil.focusId(C.TAB_SEARCH);
                S.tabUtil.tabScrollTop(s, C.TAB_SEARCH);
                let data = s.tabData.find(d => d.id === C.TAB_SEARCH);
                if (!data) return;

                data.rsInfo.results = res.searchResults;
                data.rsInfo.page = page;
                data.rsInfo.searchType = searchType;
                data.rsInfo.description = description;
                data.rsInfo.node = node;
                data.rsInfo.searchText = searchText;
                data.rsInfo.fuzzy = fuzzy;
                data.rsInfo.caseSensitive = caseSensitive;
                data.rsInfo.recursive = recursive;
                data.rsInfo.sortField = sortField;
                data.rsInfo.sortDir = sortDir;
                data.rsInfo.prop = prop;
                data.rsInfo.endReached = !res.searchResults || res.searchResults.length < J.ConstantInt.ROWS_PER_PAGE;

                S.tabUtil.selectTabStateOnly(data.id, s);
                return s;
            });
        }
        else {
            new MessageDlg("No search results found.", "Search", null, null, false, 0, null, state).open();
        }
    }

    /* prop = mtm (modification time) | ctm (create time) */
    timeline = async (node: J.NodeInfo, prop: string, state: AppState, timeRangeType: string, timelineDescription: string, page: number, recursive: boolean) => {

        /* this code AND other similar code needs a way to lockin the node, here so it can't change during pagination
        including when the page==0 because user is just jumping to beginning. Need a specific param for saying
        it's ok to reset node or not */
        if (!node) {
            node = S.nodeUtil.getHighlightedNode(state);
        }

        if (!node) {
            S.util.showMessage("No node is selected to 'timeline' under.", "Warning");
            return;
        }

        let res: J.NodeSearchResponse = await S.util.ajax<J.NodeSearchRequest, J.NodeSearchResponse>("nodeSearch", {
            page,
            nodeId: node.id,
            searchText: "",
            sortDir: "DESC",
            sortField: prop,
            searchProp: null,
            fuzzy: false,
            caseSensitive: false,
            searchDefinition: "timeline",
            searchType: null,
            timeRangeType,
            recursive,
            requirePriority: false
        });

        dispatch("Action_RenderTimelineResults", (s: AppState): AppState => {
            S.domUtil.focusId(C.TAB_TIMELINE);
            S.tabUtil.tabScrollTop(s, C.TAB_TIMELINE);
            let data = s.tabData.find(d => d.id === C.TAB_TIMELINE);
            if (!data) return;
            let info = data.rsInfo as TimelineRSInfo;

            info.results = res.searchResults;
            info.description = timelineDescription;
            info.prop = prop;
            info.timeRangeType = timeRangeType;
            info.recursive = recursive;
            info.node = node;
            info.endReached = !res.searchResults || res.searchResults.length < J.ConstantInt.ROWS_PER_PAGE;
            info.page = page;

            S.tabUtil.selectTabStateOnly(data.id, s);
            return s;
        });
    }

    removeNodeById = (id: string, state: AppState) => {
        // todo-1: we could do this a more polymorphic way and delegate deleting to each plugin type.
        state.tabData.forEach((td: TabDataIntf) => {

            // for normal resultsets
            if (td.rsInfo?.results) {
                td.rsInfo.results = td.rsInfo.results.filter(n => id !== n.id);
            }

            // for feed results
            if (td.props?.feedResults) {
                td.props.feedResults = td.props.feedResults.filter(n => id !== n.id);
            }
        });
    }

    /* If we have the Auto-Refresh checkbox checked by the user, and we just detected new changes comming in then we do a request
    from the server for a refresh */
    delayedRefreshFeed = (state: AppState): void => {
        // put in a delay timer since we call this from other state processing functions.
        setTimeout(() => {
            let feedData: TabDataIntf = S.tabUtil.getTabDataById(state, C.TAB_FEED);
            if (!feedData.props.feedLoading) {
                this.refreshFeed();
            }
        }, 500);
    }

    refreshFeed = () => {
        let feedData: TabDataIntf = S.tabUtil.getTabDataById(null, C.TAB_FEED);
        if (feedData) {
            feedData.props.page = 0;
            feedData.props.refreshCounter++;
        }

        dispatch("Action_RefreshFeed", (s: AppState): AppState => {
            feedData.props.feedLoading = true;
            return s;
        });

        S.srch.feed(feedData.props.page, feedData.props.searchTextState.getValue(), false, false);
    }

    /* growResults==true is the "infinite scrolling" support */
    feed = async (page: number, searchText: string, forceMetadataOn: boolean, growResults: boolean) => {
        let appState = store.getState();
        let feedData: TabDataIntf = S.tabUtil.getTabDataById(appState, C.TAB_FEED);
        if (!feedData) {
            return;
        }
        // console.log("Getting results page=" + page);
        let res: J.NodeFeedResponse = await S.util.ajax<J.NodeFeedRequest, J.NodeFeedResponse>("nodeFeed", {
            page,
            nodeId: feedData.props.feedFilterRootNode?.id,
            toMe: feedData.props.feedFilterToMe,
            fromMe: feedData.props.feedFilterFromMe,
            toPublic: feedData.props.feedFilterToPublic,
            localOnly: feedData.props.feedFilterLocalServer,
            fromFriends: feedData.props.feedFilterFriends,
            nsfw: feedData.props.feedFilterNSFW,
            searchText
        });

        dispatch("Action_RenderFeedResults", (s: AppState): AppState => {
            S.quanta.openGraphComps = [];
            // s.feedResults = S.quanta.removeRedundantFeedItems(res.searchResults || []);

            // once user requests their stuff, turn off the new messages count indicator.
            if (feedData.props.feedFilterToMe) {
                s.newMessageCount = 0;
            }

            s.guiReady = true;
            let scrollToTop = true;

            if (forceMetadataOn) {
                S.edit.setMetadataOption(true);
            }

            // if scrolling in new results grow the existing array
            if (growResults) {
                if (feedData?.props?.feedResults && res?.searchResults && feedData.props.feedResults.length < C.MAX_DYNAMIC_ROWS) {
                    // create a set for duplicate detection
                    let idSet: Set<string> = new Set<string>();

                    // load set for known children.
                    feedData.props.feedResults.forEach(child => {
                        idSet.add(child.id);
                    });

                    scrollToTop = false;
                    feedData.props.feedResults = feedData.props.feedResults.concat(res.searchResults.filter(child => !idSet.has(child.id)));
                    // console.log("Grow Results. Now has: " + feedData.props.feedResults.length);
                }
                else {
                    feedData.props.feedResults = res.searchResults;
                    // console.log("Replaced Results(1). Now has: " + feedData.props.feedResults.length);
                }
            }
            // else we have a fresh array (reset the array)
            else {
                feedData.props.feedResults = res.searchResults;
                // console.log("Grow Results(2). Now has: " + feedData.props.feedResults.length);
            }

            feedData.props.feedEndReached = res.endReached;
            feedData.props.feedDirty = false;
            feedData.props.feedLoading = false;

            if (scrollToTop) {
                S.tabUtil.selectTabStateOnly(C.TAB_FEED, s);
                setTimeout(() => {
                    S.view.scrollAllTop(s);
                }, 1000);
            }

            S.domUtil.focusId(C.TAB_FEED);
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

    showFollowers = async (page: number, userName: string): Promise<void> => {
        let state: AppState = store.getState();
        if (state.isAnonUser) return;

        if (!userName) {
            userName = state.userName;
        }

        let res: J.GetFollowersResponse = await S.util.ajax<J.GetFollowersRequest, J.GetFollowersResponse>("getFollowers", {
            page,
            targetUserName: userName
        });

        if (res.searchResults?.length > 0) {
            dispatch("Action_RenderSearchResults", (s: AppState): AppState => {
                S.domUtil.focusId(C.TAB_FOLLOWERS);
                S.tabUtil.tabScrollTop(s, C.TAB_FOLLOWERS);
                let data = s.tabData.find(d => d.id === C.TAB_FOLLOWERS);
                if (!data) return;
                let info = data.rsInfo as FollowersRSInfo;

                info.results = res.searchResults;
                info.page = page;
                info.searchType = null;
                info.description = null;
                info.node = null;
                info.searchText = null;
                info.fuzzy = false;
                info.caseSensitive = false;
                info.prop = null;
                info.endReached = !res.searchResults || res.searchResults.length < J.ConstantInt.ROWS_PER_PAGE;
                info.showingFollowersOfUser = userName;

                S.tabUtil.selectTabStateOnly(data.id, s);
                return s;
            });
        }
        else {
            new MessageDlg("No search results found.", "Followers", null, null, false, 0, null, state).open();
        }
    }

    showFollowing = async (page: number, userName: string): Promise<void> => {
        let state: AppState = store.getState();
        if (state.isAnonUser) return;

        if (!userName) {
            userName = state.userName;
        }

        let res: J.GetFollowingResponse = await S.util.ajax<J.GetFollowingRequest, J.GetFollowingResponse>("getFollowing", {
            page,
            targetUserName: userName
        });

        if (res.searchResults && res.searchResults.length > 0) {
            dispatch("Action_RenderSearchResults", (s: AppState): AppState => {
                S.domUtil.focusId(C.TAB_FOLLOWING);
                S.tabUtil.tabScrollTop(s, C.TAB_FOLLOWING);
                let data = s.tabData.find(d => d.id === C.TAB_FOLLOWING);
                if (!data) return;
                let info = data.rsInfo as FollowingRSInfo;

                info.results = res.searchResults;
                info.page = page;
                info.searchType = null;
                info.description = null;
                info.node = null;
                info.searchText = null;
                info.fuzzy = false;
                info.caseSensitive = false;
                info.prop = null;
                info.endReached = !res.searchResults || res.searchResults.length < J.ConstantInt.ROWS_PER_PAGE;
                info.showingFollowingOfUser = userName;

                S.tabUtil.selectTabStateOnly(data.id, s);
                return s;
            });
        }
        else {
            new MessageDlg("No search results found.", "Following", null, null, false, 0, null, state).open();
        }
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

        let clazz = isFeed ? "feed-node-table-row" : "results-node-table-row";
        if (S.render.enableRowFading && S.render.fadeInId === node.id && S.render.allowFadeInId) {
            S.render.fadeInId = null;
            S.render.allowFadeInId = false;
            clazz += " fadeInRowBkgClz";
            S.quanta.fadeStartTime = new Date().getTime();
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
            // tabIndex: "-1"
        }, [
            allowHeader ? new NodeCompRowHeader(node, true, false, isFeed, jumpButton) : null,
            content,
            allowFooter ? new NodeCompRowFooter(node, isFeed) : null
        ]);

        let divClass: string = state.highlightSearchNode?.id === node.id ? "userFeedItemHighlight" : "userFeedItem";

        return new Div(null, {
            className: isParent ? "userFeedItemParent" : divClass
        }, [parentItem, div]);
    }

    clickSearchNode = (id: string, state: AppState) => {
        dispatch("Action_RenderSearchResults", (s: AppState): AppState => {
            /*
             * update highlight node to point to the node clicked on, just to persist it for later
             */
            s.highlightSearchNode = this.idToNodeMap.get(id);
            if (!s.highlightSearchNode) {
                throw new Error("Unable to find uid in search results: " + id);
            }

            setTimeout(() => {
                S.view.jumpToId(s.highlightSearchNode.id);
            }, 500);
            return s;
        });
    }

    searchAndReplace = async (recursive: boolean, nodeId: string, search: string, replace: string, state: AppState): Promise<void> => {
        let res: J.SearchAndReplaceResponse = await S.util.ajax<J.SearchAndReplaceRequest, J.SearchAndReplaceResponse>("searchAndReplace", {
            recursive,
            nodeId,
            search,
            replace
        });
        S.view.refreshTree(null, false, false, null, false, false, true, true, false, state);
        S.util.showMessage(res.message, "Success");
    }

    /* If target is non-null we only return shares to that particlar person (or public) */
    findShares = (state: AppState = null, shareTarget: string = null, accessOption: string = null): void => {
        state = appState(state);
        const focusNode: J.NodeInfo = S.nodeUtil.getHighlightedNode(state);
        if (focusNode == null) {
            return;
        }

        let type = "all";
        if (accessOption === J.PrivilegeType.READ) {
            type = "read-only";
        }
        else if (accessOption === J.PrivilegeType.WRITE) {
            type = "appendable";
        }

        S.srch.findSharedNodes(focusNode, 0, type, shareTarget, accessOption, state);
    }
}
