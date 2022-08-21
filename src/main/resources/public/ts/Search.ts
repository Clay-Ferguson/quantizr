import { dispatch, getAppState, promiseDispatch } from "./AppContext";
import { AppState } from "./AppState";
import { Comp } from "./comp/base/Comp";
import { Clearfix } from "./comp/core/Clearfix";
import { Div } from "./comp/core/Div";
import { NodeCompContent } from "./comp/node/NodeCompContent";
import { NodeCompRowFooter } from "./comp/node/NodeCompRowFooter";
import { NodeCompRowHeader } from "./comp/node/NodeCompRowHeader";
import { Constants as C } from "./Constants";
import { MessageDlg } from "./dlg/MessageDlg";
import { FollowersRSInfo } from "./FollowersRSInfo";
import { FollowingRSInfo } from "./FollowingRSInfo";
import { TabIntf } from "./intf/TabIntf";
import * as J from "./JavaIntf";
import { SharesRSInfo } from "./SharesRSInfo";
import { S } from "./Singletons";
import { FeedTab } from "./tabs/data/FeedTab";
import { FollowersTab } from "./tabs/data/FollowersTab";
import { FollowingTab } from "./tabs/data/FollowingTab";
import { SearchTab } from "./tabs/data/SearchTab";
import { SharesTab } from "./tabs/data/SharesTab";
import { ThreadTab } from "./tabs/data/ThreadTab";
import { TimelineTab } from "./tabs/data/TimelineTab";
import { TimelineRSInfo } from "./TimelineRSInfo";

export class Search {
    findSharedNodes = async (node: J.NodeInfo, page: number, type: string, shareTarget: string, accessOption: string, state: AppState) => {
        const res = await S.util.ajax<J.GetSharedNodesRequest, J.GetSharedNodesResponse>("getSharedNodes", {
            page,
            nodeId: node.id,
            shareTarget,
            accessOption
        });
        if (res.searchResults?.length > 0) {
            dispatch("RenderSearchResults", s => {
                S.domUtil.focusId(C.TAB_SHARES);
                S.tabUtil.tabScroll(s, C.TAB_SHARES, 0);
                if (!SharesTab.inst) return;
                const info = SharesTab.inst.props as SharesRSInfo;

                info.results = res.searchResults;
                info.page = page;
                info.description = "Showing " + type + " shared nodes";
                info.node = node;
                info.shareTarget = shareTarget;
                info.accessOption = accessOption;
                info.endReached = !res.searchResults || res.searchResults.length < J.ConstantInt.ROWS_PER_PAGE;

                S.tabUtil.selectTabStateOnly(SharesTab.inst.id, s);
                return s;
            });
        }
        else {
            S.util.showMessage("No search results found for " + type + " shared nodes", "Search");
        }
    }

    showThreadAddMore = async (nodeId: string, state: AppState) => {
        const res = await S.util.ajax<J.GetThreadViewRequest, J.GetThreadViewResponse>("getNodeThreadView", {
            nodeId,
            loadOthers: false
        });

        if (res.nodes && res.nodes.length > 0) {
            dispatch("RenderThreadResults", s => {
                S.domUtil.focusId(C.TAB_THREAD);
                S.tabUtil.tabScroll(s, C.TAB_THREAD, 0);
                const data = ThreadTab.inst;
                if (!data) return;

                s.threadViewNodeId = nodeId;
                data.openGraphComps = [];

                // remove the last element, which will be a duplicate.
                const moreResults = res.nodes.slice(0, -1);

                data.props.results = [...moreResults, ...data.props.results];
                data.props.endReached = res.topReached;
                S.tabUtil.selectTabStateOnly(data.id, s);
                return s;
            });
        }
        else {
            dispatch("RenderThreadResults", s => {
                if (!ThreadTab.inst) return;
                ThreadTab.inst.props.endReached = true;
                return s;
            });
        }
    }

    showThread = async (node: J.NodeInfo) => {
        const res = await S.util.ajax<J.GetThreadViewRequest, J.GetThreadViewResponse>("getNodeThreadView", {
            nodeId: node.id,
            loadOthers: true
        });

        if (res.nodes && res.nodes.length > 0) {
            dispatch("RenderThreadResults", s => {
                s.highlightSearchNodeId = node.id;

                S.domUtil.focusId(C.TAB_THREAD);
                S.tabUtil.tabScroll(s, C.TAB_THREAD, -1); // -1 scrolls to bottom

                const data = ThreadTab.inst;
                if (!data) return;

                s.threadViewNodeId = node.id;
                data.openGraphComps = [];

                data.props.results = res.nodes;
                data.props.others = res.others;
                data.props.endReached = res.topReached;
                S.tabUtil.selectTabStateOnly(data.id, s);
                return s;
            });
        }
        else {
            // The most common known reason we can get here due to lack of feature support is when something like
            // a "object.type=Video", or "Question" type, (a type not yet supported) is encountered as we attempted to read the thread.
            let msg = "Thread not available, or contains unsupported post types.";

            // make 'msg' a little more specific if we know there's a 'remote link' showing.
            const objUrl = S.props.getPropStr(J.NodeProp.ACT_PUB_OBJ_URL, node);
            if (objUrl) {
                if (objUrl.indexOf(location.protocol + "//" + location.hostname) === -1) {
                    msg = "Top-level post. No conversation to display. Click `Remote Link` instead.";
                }
            }

            S.util.showMessage(msg, "Thread");
        }
    }

    listSubgraphByPriority = async (state: AppState) => {
        const node = S.nodeUtil.getHighlightedNode(state);
        if (!node) {
            S.util.showMessage("No node is selected to search under.", "Warning");
            return;
        }
        S.srch.search(node, null, null, state, null, "Priority Listing",
            false,
            false, 0,
            true,
            J.NodeProp.PRIORITY_FULL,
            "asc",
            true,
            null);
    }

    search = async (node: J.NodeInfo, prop: string, searchText: string, state: AppState, searchType: string, description: string, fuzzy: boolean, caseSensitive: boolean, page: number, recursive: boolean, sortField: string, sortDir: string, requirePriority: boolean, successCallback: Function) => {
        const res = await S.util.ajax<J.NodeSearchRequest, J.NodeSearchResponse>("nodeSearch", {
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

            dispatch("RenderSearchResults", s => {
                S.domUtil.focusId(C.TAB_SEARCH);
                S.tabUtil.tabScroll(s, C.TAB_SEARCH, 0);
                const data = SearchTab.inst;
                if (!data) return;

                data.openGraphComps = [];

                data.props.results = res.searchResults;
                data.props.page = page;
                data.props.searchType = searchType;
                data.props.description = description;
                data.props.node = node;
                data.props.searchText = searchText;
                data.props.fuzzy = fuzzy;
                data.props.caseSensitive = caseSensitive;
                data.props.recursive = recursive;
                data.props.sortField = sortField;
                data.props.sortDir = sortDir;
                data.props.prop = prop;
                data.props.endReached = !res.searchResults || res.searchResults.length < J.ConstantInt.ROWS_PER_PAGE;

                S.tabUtil.selectTabStateOnly(data.id, s);
                return s;
            });
        }
        else {
            new MessageDlg("No search results found.", "Search", null, null, false, 0, null).open();
        }
    }

    /* prop = mtm (modification time) | ctm (create time) */
    timeline = async (node: J.NodeInfo, prop: string, state: AppState, timeRangeType: string, timelineDescription: string, page: number, recursive: boolean) => {

        /* this code AND other similar code needs a way to lockin the node, here so it can't change during pagination
        including when the page==0 because user is just jumping to beginning. Need a specific param for saying
        it's ok to reset node or not */
        node = node || S.nodeUtil.getHighlightedNode(state);

        if (!node) {
            S.util.showMessage("No node is selected to 'timeline' under.", "Timeline");
            return;
        }

        const res = await S.util.ajax<J.NodeSearchRequest, J.NodeSearchResponse>("nodeSearch", {
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

        if (page === 0 && (!res.searchResults || res.searchResults.length === 0)) {
            S.util.showMessage("Nothing found", "Timeline");
            return;
        }

        dispatch("RenderTimelineResults", s => {
            S.domUtil.focusId(C.TAB_TIMELINE);
            S.tabUtil.tabScroll(s, C.TAB_TIMELINE, 0);
            if (!TimelineTab.inst) return;

            TimelineTab.inst.openGraphComps = [];
            const info = TimelineTab.inst.props as TimelineRSInfo;

            info.results = res.searchResults;
            info.description = timelineDescription;
            info.prop = prop;
            info.timeRangeType = timeRangeType;
            info.recursive = recursive;
            info.node = node;
            info.endReached = !res.searchResults || res.searchResults.length < J.ConstantInt.ROWS_PER_PAGE;
            info.page = page;

            S.tabUtil.selectTabStateOnly(TimelineTab.inst.id, s);
            return s;
        });
    }

    removeNodeById = (id: string, state: AppState) => {
        state.tabData.forEach((td: TabIntf) => {
            td.nodeDeleted(state, id);
        });
    }

    /* If we have the Auto-Refresh checkbox checked by the user, and we just detected new changes comming in then we do a request
    from the server for a refresh */
    delayedRefreshFeed = (state: AppState) => {
        // put in a delay timer since we call this from other state processing functions.
        setTimeout(() => {
            if (!FeedTab.inst.props.feedLoading) {
                this.refreshFeed();
            }
        }, 500);
    }

    refreshFeed = async () => {
        if (FeedTab.inst) {
            FeedTab.inst.props.page = 0;
            FeedTab.inst.props.refreshCounter++;
        }

        await promiseDispatch("RefreshFeed", s => {
            FeedTab.inst.props.feedLoading = true;
            return s;
        });

        S.srch.feed(FeedTab.inst.props.page, FeedTab.inst.props.searchTextState.getValue(), false, false);
    }

    /* growResults==true is the "infinite scrolling" support */
    feed = async (page: number, searchText: string, forceMetadataOn: boolean, growResults: boolean) => {
        const appState = getAppState();
        if (!FeedTab.inst) {
            return;
        }

        // console.log("feedData.props (at call time)=" + S.util.prettyPrint(feedData.props));

        // console.log("Getting results page=" + page + " growResults=" + growResults);
        const res = await S.util.ajax<J.NodeFeedRequest, J.NodeFeedResponse>("nodeFeed", {
            page,
            nodeId: FeedTab.inst.props.feedFilterRootNode?.id,
            toMe: FeedTab.inst.props.feedFilterToMe,
            fromMe: FeedTab.inst.props.feedFilterFromMe,
            toUser: FeedTab.inst.props.feedFilterToUser,
            toPublic: FeedTab.inst.props.feedFilterToPublic,
            localOnly: FeedTab.inst.props.feedFilterLocalServer,
            fromFriends: FeedTab.inst.props.feedFilterFriends,
            nsfw: appState.userPrefs.nsfw,
            searchText,
            applyAdminBlocks: FeedTab.inst.props.applyAdminBlocks
        });

        dispatch("RenderFeedResults", s => {
            FeedTab.inst.openGraphComps = [];
            // s.feedResults = S.quanta.removeRedundantFeedItems(res.searchResults || []);

            // once user requests their stuff, turn off the new messages count indicator.
            if (FeedTab.inst.props.feedFilterToMe) {
                s.newMessageCount = 0;
            }

            s.guiReady = true;
            let scrollToTop = true;

            if (forceMetadataOn) {
                S.edit.setMetadataOption(true);
            }

            // if scrolling in new results grow the existing array
            if (growResults) {
                if (FeedTab.inst?.props?.feedResults && res?.searchResults && FeedTab.inst.props.feedResults.length < C.MAX_DYNAMIC_ROWS) {
                    // create a set for duplicate detection
                    const idSet: Set<string> = new Set<string>();

                    // load set for known children.
                    FeedTab.inst.props.feedResults.forEach((child: any) => {
                        idSet.add(child.id);
                    });

                    scrollToTop = false;
                    FeedTab.inst.props.feedResults = FeedTab.inst.props.feedResults.concat(res.searchResults.filter(child => !idSet.has(child.id)));
                    // console.log("Grow Results. Now has: " + feedData.props.feedResults.length);
                }
                else {
                    FeedTab.inst.props.feedResults = res.searchResults;
                    // console.log("Replaced Results(1). Now has: " + feedData.props.feedResults.length);
                }
            }
            // else we have a fresh array (reset the array)
            else {
                FeedTab.inst.props.feedResults = res.searchResults;
                // console.log("Grow Results(2). Now has: " + feedData.props.feedResults.length);
            }

            FeedTab.inst.props.feedEndReached = res.endReached;
            FeedTab.inst.props.feedDirty = false;
            FeedTab.inst.props.feedLoading = false;

            if (scrollToTop) {
                S.tabUtil.tabScroll(s, C.TAB_FEED, 0);
                S.tabUtil.selectTabStateOnly(C.TAB_FEED, s);

                // Tentatively removing this, becuase we were getting a 'double scroll' effect, but oddly, even with
                // the tabScrollTop above (two lines up) we still (on mobile anyway) don't get a scrolling to the VERY top
                // but only to just where the title of the feed is showing. This is low priority. It works good enough as is. todo-1
                // setTimeout(() => {
                //     S.view.scrollAllTop(s);
                // }, 1000);
            }

            S.domUtil.focusId(C.TAB_FEED);
            return s;
        });
    }

    showFollowers = async (page: number, userName: string) => {
        const state = getAppState();
        if (state.isAnonUser) return;
        userName = userName || state.userName;

        const res = await S.util.ajax<J.GetFollowersRequest, J.GetFollowersResponse>("getFollowers", {
            page,
            targetUserName: userName
        });

        if (res.searchResults?.length > 0) {
            dispatch("RenderSearchResults", s => {
                S.domUtil.focusId(C.TAB_FOLLOWERS);
                S.tabUtil.tabScroll(s, C.TAB_FOLLOWERS, 0);
                const data = FollowersTab.inst;
                if (!data) return;
                const info = data.props as FollowersRSInfo;

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
            S.util.showMessage("No search results found.", "Followers");
        }
    }

    showFollowing = async (page: number, userName: string) => {
        const state = getAppState();
        if (state.isAnonUser) return;
        userName = userName || state.userName;

        const res = await S.util.ajax<J.GetFollowingRequest, J.GetFollowingResponse>("getFollowing", {
            page,
            targetUserName: userName
        });

        if (res.searchResults && res.searchResults.length > 0) {
            dispatch("RenderSearchResults", s => {
                S.domUtil.focusId(C.TAB_FOLLOWING);
                S.tabUtil.tabScroll(s, C.TAB_FOLLOWING, 0);
                const data = FollowingTab.inst;
                if (!data) return;
                const info = data.props as FollowingRSInfo;

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
            S.util.showMessage("No search results found.", "Following");
        }
    }

    /*
     * Renders a single line of search results on the search results page.
     */
    renderSearchResultAsListItem = (node: J.NodeInfo, tabData: TabIntf<any>, index: number, rowCount: number, prefix: string,
        isFeed: boolean, isParent: boolean, allowAvatars: boolean, jumpButton: boolean, allowHeader: boolean, allowFooter: boolean, showThreadButton: boolean, state: AppState): Comp => {
        if (!node) return;

        /* If there's a parent on this node it's a 'feed' item and this parent is what the user was replyig to so we display it just above the
        item we are rendering */
        let parentItem: Comp = null;
        if (node.parent) {
            parentItem = this.renderSearchResultAsListItem(node.parent, tabData, index, rowCount, prefix, isFeed, true, allowAvatars, jumpButton, allowHeader, allowFooter, showThreadButton, state);
        }

        const content = new NodeCompContent(node, tabData, true, true, prefix, true, null, false, false, null);

        let clazz = isFeed ? "feed-node" : "results-node";
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

        let boostComp: Div = null;
        if (node.boostedNode) {
            const boostContent = new NodeCompContent(node.boostedNode, tabData, true, true, prefix + "-boost", true, null, false, true, "feed-boost");
            // console.log("BOOST TARGET: " + S.util.prettyPrint(n.boostedNode));

            boostComp = new Div(null, { className: "boost-row" }, [
                allowHeader ? new NodeCompRowHeader(node.boostedNode, true, false, isFeed, jumpButton, showThreadButton, true) : null,
                boostContent,
                allowFooter ? new NodeCompRowFooter(node.boostedNode, isFeed, showThreadButton) : null,
                allowFooter ? new Clearfix() : null
            ])
        }

        // this divClass goes on the parent if we have a parentItem, or else on the 'itemDiv' itself if we don't
        const divClass: string = state.highlightSearchNodeId === node.id ? " userFeedItemHighlight" : " userFeedItem";

        const itemDiv = new Div(null, {
            className: clazz + (parentItem ? "" : divClass),
            // todo-1: this 'tabData.id' can be a bit long and eat some memory but not that much.
            id: tabData.id + "_" + node.id,
            nid: node.id
        }, [
            allowHeader ? new NodeCompRowHeader(node, true, false, isFeed, jumpButton, showThreadButton, false) : null,
            content,
            boostComp,
            allowFooter ? new NodeCompRowFooter(node, isFeed, showThreadButton) : null,
            allowFooter ? new Clearfix() : null
        ]);

        // if we have a parentItem wrap it and 'itemDiv' in a container Div
        if (parentItem) {
            return new Div(null, {
                className: isParent ? "userFeedItemParent" : divClass,
                // the "_p_" differentiates the parent from the 'div' which is just "_" delimeter (see above)
                id: tabData.id + "_p_" + node.id
            }, [parentItem, itemDiv]);
        }
        // othwersize 'div' itself is what we need to return, without an unnecessary div wrapping it.
        else {
            return itemDiv;
        }
    }

    clickSearchNode = (id: string, state: AppState) => {
        setTimeout(() => {
            S.view.jumpToId(id);
            dispatch("RenderSearchResults", s => {
                s.highlightSearchNodeId = id;
                return s;
            });
        }, 10);
    }

    searchAndReplace = async (recursive: boolean, nodeId: string, search: string, replace: string, state: AppState) => {
        const res = await S.util.ajax<J.SearchAndReplaceRequest, J.SearchAndReplaceResponse>("searchAndReplace", {
            recursive,
            nodeId,
            search,
            replace
        });
        S.view.refreshTree({
            nodeId: null,
            zeroOffset: false,
            renderParentIfLeaf: false,
            highlightId: null,
            forceIPFSRefresh: false,
            scrollToTop: false,
            allowScroll: true,
            setTab: true,
            forceRenderParent: false,
            state
        });
        S.util.showMessage(res.message, "Success");
    }

    /* If target is non-null we only return shares to that particlar person (or public) */
    findShares = (state: AppState = null, shareTarget: string = null, accessOption: string = null) => {
        state = getAppState(state);
        const focusNode = S.nodeUtil.getHighlightedNode(state);
        if (!focusNode) {
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
