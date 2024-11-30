import { dispatch, getAs, promiseDispatch } from "./AppContext";
import { AppState } from "./AppState";
import { Comp } from "./comp/base/Comp";
import { Clearfix } from "./comp/core/Clearfix";
import { Div } from "./comp/core/Div";
import { NodeCompContent } from "./comp/node/NodeCompContent";
import { NodeCompRowHeader } from "./comp/node/NodeCompRowHeader";
import { Constants as C } from "./Constants";
import { ConfirmDlg } from "./dlg/ConfirmDlg";
import { MessageDlg } from "./dlg/MessageDlg";
import { SearchDlg } from "./dlg/SearchDlg";
import { DocumentRSInfo } from "./DocumentRSInfo";
import { FollowersRSInfo } from "./FollowersRSInfo";
import { FollowingRSInfo } from "./FollowingRSInfo";
import { TabBase } from "./intf/TabBase";
import * as J from "./JavaIntf";
import { NodeInfo, PrincipalName } from "./JavaIntf";
import { SharesRSInfo } from "./SharesRSInfo";
import { S } from "./Singletons";
import { DocumentTab } from "./tabs/data/DocumentTab";
import { FeedTab } from "./tabs/data/FeedTab";
import { FollowersTab } from "./tabs/data/FollowersTab";
import { FollowingTab } from "./tabs/data/FollowingTab";
import { RepliesTab } from "./tabs/data/RepliesTab";
import { SearchTab } from "./tabs/data/SearchTab";
import { SharesTab } from "./tabs/data/SharesTab";
import { ThreadTab } from "./tabs/data/ThreadTab";
import { TimelineTab } from "./tabs/data/TimelineTab";
import { TimelineRSInfo } from "./TimelineRSInfo";

export class Search {
    _openSearchDlg = () => {
        new SearchDlg().open();
    }

    async findSharedNodes(node: NodeInfo, page: number, type: string, shareTarget: string, accessOption: string) {
        const res = await S.rpcUtil.rpc<J.GetSharedNodesRequest, J.GetSharedNodesResponse>("getSharedNodes", {
            page,
            nodeId: node.id,
            shareTarget,
            accessOption
        });
        S.nodeUtil.processInboundNodes(res.searchResults);

        if (res.searchResults?.length > 0) {
            dispatch("RenderSearchResults", _s => {
                S.domUtil.focusId(C.TAB_SHARES);
                S.tabUtil.tabScroll(C.TAB_SHARES, 0);
                if (!SharesTab.inst) return;
                const info = SharesTab.inst.props as SharesRSInfo;

                info.results = res.searchResults;
                info.page = page;
                info.description = "Showing " + type + " shared nodes";
                info.node = node;
                info.shareTarget = shareTarget;
                info.accessOption = accessOption;
                info.endReached = !res.searchResults || res.searchResults.length < J.ConstantInt.ROWS_PER_PAGE;

                S.tabUtil.selectTabStateOnly(SharesTab.inst.id);
            });
        }
        else {
            S.util.showMessage("No search results found for " + type + " shared nodes", "Search");
        }
    }

    async showThread(nodeId: string) {
        // First call the server in case it has enough data already to render the Thread, in which
        // case we don't need to load any events from relays via client
        const res = await S.rpcUtil.rpc<J.GetThreadViewRequest, J.GetThreadViewResponse>("getNodeThreadView", {
            nodeId,
            // if 'loadOthers' is true we add more tree content at more levels up the tree rather than the pure history of replies
            loadOthers: false // todo-2: disabling this for now, to make AI threads cleaner looking
        });
        S.nodeUtil.processInboundNodes(res.nodes);

        const node = res.nodes?.length > 0 ? res.nodes[res.nodes.length - 1] : null;

        if (res.nodes?.length > 0) {
            S.histUtil.pushHistory(nodeId, ThreadTab.URL_PARAM);

            dispatch("RenderThreadResults", s => {
                s.highlightSearchNodeId = node.id;
                S.domUtil.focusId(C.TAB_THREAD);
                S.tabUtil.tabScroll(C.TAB_THREAD, -1); // -1 scrolls to bottom

                const data = ThreadTab.inst;
                if (!data) return;

                // update threadViewFromTab only if NOT currently comming from thread tab itself
                if (s.activeTab !== C.TAB_THREAD) {
                    s.threadViewFromTab = s.activeTab;
                }

                if (!s.threadViewFromTab) {
                    s.threadViewFromTab = C.TAB_MAIN;
                }

                s.threadViewFromNodeId = node.id;
                data.openGraphComps = [];
                data.props.results = res.nodes;

                // if apReplies then we set endReached to 'true' always.
                data.props.endReached = res.topReached;
                S.tabUtil.selectTabStateOnly(data.id);
            });
        }
    }

    async showReplies(node: NodeInfo) {
        const res = await S.rpcUtil.rpc<J.GetRepliesViewRequest, J.GetRepliesViewResponse>("getNodeRepliesView", {
            nodeId: node.id
        });
        S.nodeUtil.processInboundNodes(res.nodes);

        if (res.nodes && res.nodes.length > 0) {
            dispatch("RenderRepliesResults", s => {
                s.highlightSearchNodeId = node.id;

                S.domUtil.focusId(C.TAB_REPLIES);
                S.tabUtil.tabScroll(C.TAB_REPLIES, -1); // -1 scrolls to bottom

                const data = RepliesTab.inst;
                if (!data) return;

                s.repliesViewFromTab = s.activeTab;
                s.repliesViewNodeId = node.id;
                data.openGraphComps = [];
                data.props.results = res.nodes;
                data.props.endReached = true;
                S.tabUtil.selectTabStateOnly(data.id);
            });
        }
    }

    async listSubgraphByPriority() {
        const node = S.nodeUtil.getHighlightedNode();
        if (!node) {
            S.util.showMessage("No node is selected to search under.", "Warning");
            return;
        }
        this.search(null, node.id, null, null, null, "Priority Listing", null, false, false, 0, true,
            J.NodeProp.PRIORITY_FULL, "asc", true, false, false, false, false);
    }

    async deleteSearchDef(searchDefName: string) {
        const dlg = new ConfirmDlg("Confirm Delete Search: " + searchDefName, "Warning");
        await dlg.open();
        if (dlg.yes) {
            const res = await S.rpcUtil.rpc<J.DeleteSearchDefRequest, J.DeleteSearchDefResponse>("deleteSearchDef", {
                searchDefName
            });
            if (res.searchDefs) {
                dispatch("RenderSearchDefs", s => {
                    s.searchDefs = res.searchDefs;
                });
            }
        }
    }

    async runSearchDef(searchDef: J.SearchDefinition) {
        const node = S.nodeUtil.getHighlightedNode();
        if (!node) {
            S.util.showMessage("No node is selected to search under.", "Warning");
            return;
        }
        this.search(null, node.id, searchDef.searchProp, searchDef.searchText, "node.content", searchDef.name,
            node.id, searchDef.fuzzy, searchDef.caseSensitive, 0, searchDef.recursive, searchDef.sortField,
            searchDef.sortDir, searchDef.requirePriority, searchDef.requireAttachment, false,
            true, searchDef.requireDate);
    }

    async search(name: string, nodeId: string, prop: string, searchText: string, searchType: string, description: string,
        searchRoot: string, fuzzy: boolean, caseSensitive: boolean, page: number, recursive: boolean,
        sortField: string, sortDir: string, requirePriority: boolean, requireAttachment: boolean, deleteMatches: boolean,
        jumpIfSingleResult: boolean, requireDate: boolean): Promise<boolean> {

        const res = await S.rpcUtil.rpc<J.NodeSearchRequest, J.NodeSearchResponse>("nodeSearch", {
            searchDefinition: {
                name,
                searchText, sortDir, sortField, searchProp: prop, fuzzy, caseSensitive,
                recursive, requirePriority,
                requireAttachment,
                requireDate,
                displayLayout: "list"
            },
            searchRoot,
            page,
            nodeId, // for user searchTypes this node can be null
            searchType,
            view: "search",
            timeRangeType: null,
            deleteMatches,
        });

        // if exactly one search result found we might want to optionally jump to it on the tree
        if (jumpIfSingleResult && res.searchResults?.length == 1) {
            S.view.jumpToId(res.searchResults[0].id);
            return;
        }

        S.nodeUtil.processInboundNodes(res.searchResults);

        if (res.code == C.RESPONSE_CODE_OK && deleteMatches) {
            S.util.showMessage("Matches were deleted.", "Warning");
            return true;
        }

        if (res.searchResults && res.searchResults.length > 0) {
            dispatch("RenderSearchResults", s => {
                S.domUtil.focusId(C.TAB_SEARCH);
                S.tabUtil.tabScroll(C.TAB_SEARCH, 0);
                const data = SearchTab.inst;
                if (!data) return;

                s.highlightText = searchText;

                data.openGraphComps = [];
                data.props.results = res.searchResults;
                data.props.page = page;
                data.props.searchType = searchType;
                data.props.description = description;
                data.props.node = res.node;
                data.props.searchText = searchText;
                data.props.fuzzy = fuzzy;
                data.props.caseSensitive = caseSensitive;
                data.props.recursive = recursive;
                data.props.sortField = sortField;
                data.props.requirePriority = requirePriority;
                data.props.requireAttachment = requireAttachment;
                data.props.requireDate = requireDate;
                data.props.sortDir = sortDir;
                data.props.prop = prop;
                data.props.endReached = !res.searchResults || res.searchResults.length < J.ConstantInt.ROWS_PER_PAGE;

                S.tabUtil.selectTabStateOnly(data.id);

                // DO NOT DELETE
                // This was an experiment an it does work, but it only highlights one thing at a time, when I
                // was hoping it would highlight ALL search results at once. So I think CTRL-F is superior.
                // if (searchText) {
                //     setTimeout(() => (window as any).find(searchText, false), 1000); //window.find
                // }
            });
            return true;
        }
        else {
            new MessageDlg("No search results found.", "Search", null, null, false, 0, null).open();
            return false;
        }
    }

    async showDocument(rootId: string, scrollToTop: boolean, searchDefinition: J.SearchDefinition) {
        const res = await S.rpcUtil.rpc<J.RenderDocumentRequest, J.RenderDocumentResponse>("renderDocument", {
            searchDefinition,
            rootId,
            includeComments: getAs().userPrefs.showReplies
        });
        S.nodeUtil.processInboundNodes(res.searchResults);
        S.histUtil.pushHistory(rootId, DocumentTab.URL_PARAM);

        if (!res.searchResults || res.searchResults.length === 0) {
            dispatch("RenderDocumentResults", s => {
                DocumentTab.inst.openGraphComps = [];
                const info = DocumentTab.inst.props as DocumentRSInfo;
                info.breadcrumbs = res.breadcrumbs;
                s.menuIndexToggle = S.util.willRenderDocIndex(s) ? "index" : "menu";
            });
            return;
        }

        dispatch("RenderDocumentResults", s => {
            S.domUtil.focusId(C.TAB_DOCUMENT);
            if (!DocumentTab.inst) return;
            DocumentTab.inst.openGraphComps = [];
            const info = DocumentTab.inst.props as DocumentRSInfo;
            info.breadcrumbs = res.breadcrumbs;
            if (scrollToTop) {
                S.tabUtil.tabScroll(C.TAB_DOCUMENT, 0);
            }

            if (searchDefinition) {
                s.highlightText = searchDefinition.searchText;
            }

            // set 'results' if this is the top of page being rendered, or else append results if we
            // were pulling down more items at the end of the doc.
            info.results = res.searchResults;
            info.node = res.searchResults[0];
            s.menuIndexToggle = S.util.willRenderDocIndex(s) ? "index" : "menu";
            S.tabUtil.selectTabStateOnly(DocumentTab.inst.id);
        });
    }

    _timeline = () => {
        this.timeline(null, "mtm", null, "by Modify Time (recursive)", 0, true);
    }

    async timelineWithOptions(prop: string, recursive: boolean) {
        let description = prop === "ctm" ? "by Create Time" : "by Modify Time";
        description += recursive ? " (recursive)" : " (non-recursive)";
        this.timeline(null, prop, null, description, 0, recursive);
    }

    /* prop = mtm (modification time) | ctm (create time) */
    async timeline(nodeId: string, prop: string, timeRangeType: string, timelineDescription: string, page: number,
        recursive: boolean) {

        /* this code AND other similar code needs a way to lockin the node, here so it can't change
        during pagination including when the page==0 because user is just jumping to beginning. Need
        a specific param for saying it's ok to reset node or not */
        if (!nodeId) {
            const node = S.nodeUtil.getHighlightedNode();
            if (node) {
                nodeId = node.id;
            }
        }

        if (!nodeId) {
            S.util.showMessage("No node is selected to 'timeline' under.", "Timeline");
            return;
        }

        // Note: we don't need to pass 'searchRoot' to the browser, but we do set it in this view's
        // data property because we need it on the client side
        const res = await S.rpcUtil.rpc<J.NodeSearchRequest, J.NodeSearchResponse>("nodeSearch", {
            searchDefinition: {
                name: null,
                searchText: "", sortDir: "DESC", sortField: prop,
                searchProp: null, fuzzy: false, caseSensitive: false,
                recursive,
                requirePriority: false,
                requireAttachment: false,
                requireDate: false,
                displayLayout: "list"
            },
            searchRoot: null,
            page,
            nodeId,
            view: "timeline",
            searchType: null,
            timeRangeType,
            deleteMatches: false,
        });
        S.nodeUtil.processInboundNodes(res.searchResults);

        if (page === 0 && (!res.searchResults || res.searchResults.length === 0)) {
            S.util.showMessage("Nothing found", "Timeline");
            return;
        }

        S.histUtil.pushHistory(nodeId, TimelineTab.URL_PARAM);

        dispatch("RenderTimelineResults", () => {
            S.domUtil.focusId(C.TAB_TIMELINE);
            S.tabUtil.tabScroll(C.TAB_TIMELINE, 0);
            if (!TimelineTab.inst) return;

            TimelineTab.inst.openGraphComps = [];
            const info = TimelineTab.inst.props as TimelineRSInfo;

            info.results = res.searchResults;
            info.description = timelineDescription;
            info.prop = prop;
            info.timeRangeType = timeRangeType;
            info.recursive = recursive;
            info.node = res.node;
            info.endReached = !res.searchResults || res.searchResults.length < J.ConstantInt.ROWS_PER_PAGE;
            info.page = page;
            info.searchRoot = res.node.path;

            S.tabUtil.selectTabStateOnly(TimelineTab.inst.id);
        });
    }

    removeNodeById(id: string, ust: AppState) {
        ust.tabData.forEach(td => td.nodeDeleted(ust, id));
    }

    _refreshFeed = async () => {
        if (FeedTab.inst) {
            FeedTab.inst.props.page = 0;
            FeedTab.inst.props.refreshCounter++;
        }

        const searchText = FeedTab.inst.props.searchTextState.getValue();
        await promiseDispatch("RefreshFeed", s => {
            FeedTab.inst.props.feedLoading = true;
            if (!searchText) {
                s.displayFeedSearch = false;
            }
        });

        this.feed(FeedTab.inst.props.page, searchText, false);
    }

    /* growResults==true is the "infinite scrolling" support */
    async feed(page: number, searchText: string, growResults: boolean) {
        const ast = getAs();
        if (!FeedTab.inst) {
            return;
        }

        const loadFriendsTags: boolean = ast.friendHashTags === null;

        const res = await S.rpcUtil.rpc<J.NodeFeedRequest, J.NodeFeedResponse>("nodeFeed", {
            page,
            toMe: FeedTab.inst.props.feedFilterToMe,
            fromMe: FeedTab.inst.props.feedFilterFromMe,
            toUser: FeedTab.inst.props.feedFilterToUser,
            toPublic: FeedTab.inst.props.feedFilterToPublic,
            name: FeedTab.inst.props.name,
            fromFriends: FeedTab.inst.props.feedFilterFriends,
            searchText,
            friendsTagSearch: FeedTab.inst.props.friendsTagSearch,
            loadFriendsTags,
            applyAdminBlocks: FeedTab.inst.props.applyAdminBlocks
        }, true);
        // console.log("INBOUND NODE FEED: " + S.util.prettyPrint(res.searchResults));
        S.nodeUtil.processInboundNodes(res.searchResults);

        dispatch("RenderFeedResults", s => {
            FeedTab.inst.openGraphComps = [];

            // once user requests their stuff, turn off the new messages count indicator.
            if (FeedTab.inst.props.feedFilterToMe) {
                s.myNewMessageCount = 0;
            }

            let scrollToTop = true;

            // if scrolling in new results grow the existing array
            if (growResults) {
                if (FeedTab.inst?.props?.results && res?.searchResults && FeedTab.inst.props.results.length < C.MAX_DYNAMIC_ROWS) {
                    // create a set for duplicate detection
                    const idSet: Set<string> = new Set<string>();

                    // load set for known children.
                    FeedTab.inst.props.results.forEach(child => idSet.add(child.id));

                    scrollToTop = false;
                    FeedTab.inst.props.results = FeedTab.inst.props.results.concat(res.searchResults.filter(child => !idSet.has(child.id)));
                }
                else {
                    FeedTab.inst.props.results = res.searchResults;
                }
            }
            // else we have a fresh array (reset the array)
            else {
                FeedTab.inst.props.results = res.searchResults;
            }

            FeedTab.inst.props.feedEndReached = res.endReached;
            FeedTab.inst.props.feedDirty = false;
            FeedTab.inst.props.feedLoading = false;

            if (res.friendHashTags) {
                s.friendHashTags = res.friendHashTags;
            }

            if (scrollToTop) {
                S.tabUtil.tabScroll(C.TAB_FEED, 0);
                S.tabUtil.selectTabStateOnly(C.TAB_FEED);
            }

            S.domUtil.focusId(C.TAB_FEED);
        });
    }

    async showFollowers(page: number, userName: string) {
        const ast = getAs();
        if (ast.isAnonUser) return;
        userName = userName || ast.userName;

        const res = await S.rpcUtil.rpc<J.GetFollowersRequest, J.GetFollowersResponse>("getFollowers", {
            page,
            targetUserName: userName
        });

        if (res.searchResults?.length > 0) {
            dispatch("RenderSearchResults", _s => {
                S.domUtil.focusId(C.TAB_FOLLOWERS);
                S.tabUtil.tabScroll(C.TAB_FOLLOWERS, 0);
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

                S.tabUtil.selectTabStateOnly(data.id);
            });
        }
        else {
            S.util.showMessage("No search results found.", "Followers");
        }
    }

    async showFollowing(page: number, userName: string) {
        const ast = getAs();
        if (ast.isAnonUser) return;
        userName = userName || ast.userName;

        const res = await S.rpcUtil.rpc<J.GetFollowingRequest, J.GetFollowingResponse>("getFollowing", {
            page,
            targetUserName: userName
        });

        if (res.searchResults && res.searchResults.length > 0) {
            dispatch("RenderSearchResults", () => {
                S.domUtil.focusId(C.TAB_FOLLOWING);
                S.tabUtil.tabScroll(C.TAB_FOLLOWING, 0);
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

                S.tabUtil.selectTabStateOnly(data.id);
            });
        }
        else {
            S.util.showMessage("No search results found.", "Following");
        }
    }

    _clickHandler = (evt: Event) => {
        const nodeId = S.domUtil.getNodeIdFromDom(evt);
        if (!nodeId) return;
        const node = S.nodeUtil.findNode(nodeId);
        if (!node) return;
        S.histUtil.updateNodeHistory(node, true);

        // after updating state we need this to ensure this click also focused this window.
        const tabId = S.domUtil.getPropFromDom(evt, C.TAB_ID_ATTR);
        if (!tabId) return;
        S.domUtil.focusId(tabId);
    }

    /*
     * Renders a single line of search results on the search results page
     */
    renderSearchResultAsListItem(node: NodeInfo, tabData: TabBase<any>, jumpButton: boolean, allowHeader: boolean,
        outterClass: string, outterClassHighlight: string,
        extraStyle: any): Comp {
        const ast = getAs();
        if (!node) return;
        const prefix = tabData.id;

        if (node.id == getAs().indexHighlightNode) {
            outterClassHighlight = outterClassHighlight || "";
            outterClassHighlight += " docNodeHighlight";
        }

        // render with info bar, etc always, if this is a threaview or freed tab.
        const isFeed = tabData.id === C.TAB_THREAD || tabData.id === C.TAB_FEED || tabData.id === C.TAB_REPLIES;
        const content = new NodeCompContent(node, tabData, true, true, prefix, true, false, null);
        let clazz = isFeed ? "feedNode" : "resultsNode";
        if (S.render.enableRowFading && S.render.fadeInId === node.id && S.render.allowFadeInId) {
            S.render.fadeInId = null;
            S.render.allowFadeInId = false;
            clazz += " fadeInRowBkgClz";
            S.quanta.fadeStartTime = new Date().getTime();
        }

        // this divClass goes on the parent if we have a parentItem, or else on the 'itemDiv' itself if we don't
        let divClass: string = ast.highlightSearchNodeId === node.id ? outterClassHighlight : outterClass;
        divClass = divClass || "";

        const attrs: any = {
            // yes the 'tabData.id' looks odd here as a class, and it's only used for lookups for scrolling logic.
            className: `${clazz} ${divClass} ${tabData.id}`,
            id: S.tabUtil.makeDomIdForNode(tabData, node.id),
            [C.NODE_ID_ATTR]: node.id,
            [C.TAB_ID_ATTR]: tabData.id,
            onClick: this._clickHandler
        };

        if (extraStyle) {
            attrs.style = extraStyle;
        }

        // special case, if node is owned by admin and we're not admin, never show header, unless the ALLOW flag is true
        if (!C.ALLOW_ADMIN_NODE_HEADERS && node.owner === PrincipalName.ADMIN && ast.userName !== PrincipalName.ADMIN) {
            allowHeader = false;
        }

        const itemDiv = new Div(null, attrs, [
            // we use 2 as 'idx' here becasue we just want anything but 1 (which indicates 'first')
            allowHeader ? new NodeCompRowHeader(node, true, false, tabData, jumpButton, tabData.id, 2, 1, false) : null,
            allowHeader ? new Clearfix() : null,
            content,
            null,
            S.render.renderLinks(node, tabData)
        ]);

        return itemDiv;
    }

    async clickSearchNode(id: string) {
        await S.view.jumpToId(id);

        dispatch("RenderSearchResults", s => {
            s.highlightSearchNodeId = id;
        });
    }

    async modifySubGraph(recursive: boolean, nodeId: string, hashtags: string, action: string) {
        const res = await S.rpcUtil.rpc<J.ModifySubGraphRequest, J.ModifySubGraphResponse>("modifySubGraph", {
            recursive,
            nodeId,
            hashtags,
            action
        });

        S.view.refreshTree({
            nodeId: null,
            zeroOffset: false,
            highlightId: null,
            scrollToTop: false,
            allowScroll: true,
            setTab: true,
            forceRenderParent: false,
            jumpToRss: false
        });
        S.util.showMessage(res.message, "Success");
    }

    async searchAndReplace(recursive: boolean, nodeId: string, search: string, replace: string) {
        const res = await S.rpcUtil.rpc<J.SearchAndReplaceRequest, J.SearchAndReplaceResponse>("searchAndReplace", {
            recursive,
            nodeId,
            search,
            replace
        });

        S.view.refreshTree({
            nodeId: null,
            zeroOffset: false,
            highlightId: null,
            scrollToTop: false,
            allowScroll: true,
            setTab: true,
            forceRenderParent: false,
            jumpToRss: false
        });
        S.util.showMessage(res.message, "Success");
    }

    /* If target is non-null we only return shares to that particlar person (or public) */
    findShares(shareTarget: string = null, accessOption: string = null) {
        const focusNode = S.nodeUtil.getHighlightedNode();
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

        this.findSharedNodes(focusNode, 0, type, shareTarget, accessOption);
    }

    _findRdfSubjects = () => {
        dispatch("findRdfSubjects", _s => {
            const node = S.nodeUtil.getHighlightedNode();
            if (node) {
                this.search(null, node.id, null, null, J.Constant.SEARCH_TYPE_RDF_SUBJECTS, "RDF Subjects", null, false,
                    false, 0, true, null, null, false, false, false, false, false);
            }
        });
    };
}
