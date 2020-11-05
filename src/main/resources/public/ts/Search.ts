import { dispatch } from "./AppRedux";
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
import { Button } from "./widget/Button";
import { Div } from "./widget/Div";
import { HorizontalLayout } from "./widget/HorizontalLayout";

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

    idToNodeMap: { [key: string]: J.NodeInfo } = {};

    numSearchResults = (res: J.NodeSearchResponse): number => {
        return !!res && //
            !!res.searchResults && //
            !!res.searchResults.length //
            ? res.searchResults.length : 0;
    }

    searchNodesResponse = (res: J.NodeSearchResponse) => {
        dispatch({
            type: "Action_RenderSearchResults",
            update: (s: AppState): void => {
                s.searchResults = res.searchResults;
            }
        });

        S.meta64.selectTab("searchTab");
    }

    timelineResponse = (res: J.NodeSearchResponse) => {
        dispatch({
            type: "Action_RenderTimelineResults",
            update: (s: AppState): void => {
                s.timelineResults = res.searchResults;
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
    timeline = (prop: string, state: AppState) => {
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
            searchDefinition: ""
        }, this.timelineResponse);
    }

    feed = (nodeId: string) => {
        S.util.ajax<J.NodeFeedRequest, J.NodeFeedResponse>("nodeFeed", {
            nodeId
        }, this.feedResponse);
    }

    feedResponse = (res: J.NodeFeedResponse) => {
        dispatch({
            type: "Action_RenderFeedResults",
            update: (s: AppState): void => {
                // s.feedResults = S.meta64.removeRedundantFeedItems(res.searchResults || []);
                s.feedResults = res.searchResults;
                s.feedDirty = false;
            }
        });
        S.meta64.selectTab("feedTab");
    }

    initSearchNode = (node: J.NodeInfo) => {
        this.idToNodeMap[node.id] = node;

        // NOTE: only the getFeed call (Feed tab) will have items with some parents populated.
        if (node.parent) {
            this.idToNodeMap[node.parent.id] = node.parent;
        }
    }

    /*
     * Renders a single line of search results on the search results page.
     */
    renderSearchResultAsListItem = (node: J.NodeInfo, index: number, count: number, rowCount: number, prefix: string, isFeed: boolean, isParent: boolean, allowAvatars: boolean, state: AppState): Comp => {

        /* If there's a parent on this node it's a 'feed' item and this parent is what the user was replyig to so we display it just above the
        item we are rendering */
        let parentItem: Comp = null;
        if (node.parent) {
            parentItem = this.renderSearchResultAsListItem(node.parent, index, count, rowCount, prefix, isFeed, true, allowAvatars, state);
        }

        const cssId = this._UID_ROWID_PREFIX + node.id;
        const buttonBar = this.makeButtonBarHtml(node, state);
        const content = new NodeCompContent(node, true, true, prefix, true, null);

        let clazz = "node-table-row";
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
            onClick: S.meta64.getNodeFunc(this.cached_clickOnSearchResultRow, "S.srch.clickOnSearchResultRow", node.id),
            id: cssId
        }, [
            buttonBar,
            new NodeCompRowHeader(node, allowAvatars, isFeed),
            content,
            isFeed ? new NodeCompRowFooter(node, isFeed) : null
        ]);

        return new Div(null, {
            className: isParent ? "userFeedItemParent" : "userFeedItem"
        }, [parentItem, div]);
    }

    makeButtonBarHtml = (node: J.NodeInfo, state: AppState): Comp => {
        return new HorizontalLayout([
            new Button("Jump", () => {
                this.clickSearchNode(node.id, state);
            }, {
                title: "Jump to this Node in the Main Tab",
                id: "go-" + node.id
            }, "btn-secondary marginLeft"),
            new Div(null, { className: "clearfix" })
        ], "marginTop marginLeft float-right");
    }

    cached_clickOnSearchResultRow = (id: string) => {
        // this implementation is obsolete (update if we ever need to uncomment this)

        // DO NOT DELETE (this works, and may be needed some day)
        // There's really no reason to indicate to user what row is highlighted, so I let't just not clutter the screen for now
        // this.setRowHighlight(false);
        // this.highlightRowNode = this.idToNodeMap[id];
        // this.setRowHighlight(true);
    }

    clickSearchNode = (id: string, state: AppState) => {
        /*
         * update highlight node to point to the node clicked on, just to persist it for later
         */
        this.highlightRowNode = this.idToNodeMap[id];
        if (!this.highlightRowNode) {
            throw new Error("Unable to find uid in search results: " + id);
        }

        S.view.refreshTree(this.highlightRowNode.id, true, true, this.highlightRowNode.id, false, true, true, state);
    }

    /*
     * turn of row selection styling of whatever row is currently selected
     */
    setRowHighlight = (state: boolean) => {

        if (!this.highlightRowNode) {
            return;
        }

        /* now make CSS id from node */
        const nodeId = this._UID_ROWID_PREFIX + this.highlightRowNode.id;

        const elm: HTMLElement = S.util.domElm(nodeId);
        if (elm) {
            /* change class on element */
            S.util.changeOrAddClassToElm(elm,
                state ? "inactive-row" : "active-row",
                state ? "active-row" : "inactive-row");
        }
    }
}
