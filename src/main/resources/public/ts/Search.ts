console.log("Search.ts");

import * as I from "./Interfaces";
import { MessageDlg } from "./dlg/MessageDlg";
import { SearchIntf } from "./intf/SearchIntf";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants } from "./Constants";
import { Button } from "./widget/Button";
import { Div } from "./widget/Div";
import { Comp } from "./widget/base/Comp";
import { NodeInfo, NodeSearchResponse } from "./Interfaces";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class Search implements SearchIntf {

    _UID_ROWID_PREFIX: string = "srch_row_";

    searchNodes: any = null;

    searchOffset = 0;
    timelineOffset = 0;

    /*
     * Holds the NodeSearchResponse.java JSON, or null if no search has been done.
     */
    searchResults: any = null;

    /*
     * Holds the NodeSearchResponse.java JSON, or null if no timeline has been done.
     */
    timelineResults: any = null;

    /*
     * Will be the last row clicked on (NodeInfo.java object) and having the red highlight bar
     */
    highlightRowNode: I.NodeInfo = null;

    /*
     * maps node 'identifier' (assigned at server) to uid value which is a value based off local sequence, and uses
     * nextUid as the counter.
     */
    identToUidMap: any = {};

    /*
     * maps node.uid values to the NodeInfo.java objects
     *
     * The only contract about uid values is that they are unique insofar as any one of them always maps to the same
     * node. Limited lifetime however. The server is simply numbering nodes sequentially. Actually represents the
     * 'instance' of a model object. Very similar to a 'hashCode' on Java objects.
     */
    uidToNodeMap: { [key: string]: I.NodeInfo } = {};

    numSearchResults = () => {
        return this.searchResults != null && //
            this.searchResults.searchResults != null && //
            this.searchResults.searchResults.length != null ? //
            this.searchResults.searchResults.length : 0;
    }

    searchTabActivated = () => {
    }

    searchNodesResponse = (res: I.NodeSearchResponse) => {
        this.searchResults = res;
        if (this.numSearchResults() == 0) {
            new MessageDlg("No search results found.", "Search").open();
            return;
        }

        S.srch.populateSearchResultsPage(S.srch.searchResults, "searchResultsPanel"); 
        S.meta64.selectTab("searchTab");
    }

    timelineResponse = (res: I.NodeSearchResponse) => {
        this.timelineResults = res;
        S.srch.populateSearchResultsPage(S.srch.timelineResults, "timelineResultsPanel"); 
        S.meta64.selectTab("timelineTab");
    }

    searchFilesResponse = (res: I.FileSearchResponse) => {
        S.nav.mainOffset = 0;
        S.util.ajax<I.RenderNodeRequest, I.RenderNodeResponse>("renderNode", {
            "nodeId": res.searchResultNodeId,
            "upLevel": null,
            "renderParentIfLeaf": null,
            "offset": 0,
            "goToLastPage": false
        }, S.nav.navPageNodeResponse);
    }

    /* prop = mtm (modification time) | ctm (create time) */
    timeline = (prop: string) => {
        let node = S.meta64.getHighlightedNode();
        if (!node) {
            S.util.showMessage("No node is selected to 'timeline' under.");
            return;
        }

        S.util.ajax<I.NodeSearchRequest, I.NodeSearchResponse>("nodeSearch", {
            "nodeId": node.id,
            "searchText": "",
            "sortDir": "DESC",
            "sortField": prop,
            "searchProp": null
        }, this.timelineResponse);
    }

    initSearchNode = (node: I.NodeInfo) => {
        node.uid = S.util.getUidForId(this.identToUidMap, node.id);
        this.uidToNodeMap[node.uid] = node;
    }

    populateSearchResultsPage = (data: NodeSearchResponse, viewName) => {
        let childCount = data.searchResults.length;

        /*
         * Number of rows that have actually made it onto the page to far. Note: some nodes get filtered out on the
         * client side for various reasons.
         */
        let rowCount = 0;

        let output: Comp[] = [];
        let i=-1;
        data.searchResults.forEach((node: NodeInfo) => {
            i++;
            if (S.meta64.isNodeBlackListed(node))
                return;

            this.initSearchNode(node);

            rowCount++;
            output.push(this.renderSearchResultAsListItem(node, i, childCount, rowCount));
        });


        let div = new Div(null, null, output);
        div.reactRenderToDOM(viewName);
    }

    /*
     * Renders a single line of search results on the search results page.
     *
     * node is a NodeInfo.java JSON
     */
    renderSearchResultAsListItem = (node: NodeInfo, index: number, count: number, rowCount: number): Comp => {
        let uid = node.uid;
        console.log("renderSearchResult: " + uid);

        let cssId = this._UID_ROWID_PREFIX + uid;
        // console.log("Rendering Node Row[" + index + "] with id: " +cssId)

        let buttonBar = this.makeButtonBarHtml("" + uid);

        let content: Comp[] = S.render.renderNodeContent(node, true, true, true, true, true);
        let thiz = this;

        return new Div(null, {
            className: "node-table-row inactive-row",
            onClick: (elm: HTMLElement) => {
                S.meta64.clickOnSearchResultRow(uid);
            }, //
            "id": cssId
        },//
            [
                buttonBar//
                , new Div(null, {
                    "id": "srch_content_" + uid
                }, content)
            ]);
    }

    makeButtonBarHtml = (uid: string): Comp => {
        let gotoButton = new Button("Go to Node", () => {
            S.meta64.clickSearchNode(uid);
        }, { id: "go-to-" + uid });
        return S.render.makeHorizontalFieldSet([gotoButton]);
    }

    clickOnSearchResultRow = (uid: string) => {
        this.setRowHighlight(false);
        this.highlightRowNode = this.uidToNodeMap[uid];
        this.setRowHighlight(true);
    }

    clickSearchNode = (uid: string) => {
        /*
         * update highlight node to point to the node clicked on, just to persist it for later
         */
        this.highlightRowNode = this.uidToNodeMap[uid];
        if (!this.highlightRowNode) {
            throw "Unable to find uid in search results: " + uid;
        }

        S.view.refreshTree(this.highlightRowNode.id, true, this.highlightRowNode.id);
        S.meta64.selectTab("mainTab");
    }

    /*
     * turn of row selection styling of whatever row is currently selected
     */
    setRowHighlight = (state: boolean) => {

        if (!this.highlightRowNode) {
            return;
        }

        /* now make CSS id from node */
        let nodeId = this._UID_ROWID_PREFIX + this.highlightRowNode.uid;

        let elm: HTMLElement = S.util.domElm(nodeId);
        if (elm) {
            /* change class on element */
            S.util.changeOrAddClassToElm(elm,
                state ? "inactive-row" : "active-row",
                state ? "active-row" : "inactive-row");
        }
    }
}
