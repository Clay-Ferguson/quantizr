import * as J from "./JavaIntf";
import { MessageDlg } from "./dlg/MessageDlg";
import { SearchIntf } from "./intf/SearchIntf";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants as C } from "./Constants";
import { Button } from "./widget/Button";
import { Div } from "./widget/Div";
import { Comp } from "./widget/base/Comp";

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
     * Holds the NodeSearchResponse.java JSON, or null if no search has been done.
     */
    searchResults: J.NodeSearchResponse = null;

    /*
     * Holds the NodeSearchResponse.java JSON, or null if no timeline has been done.
     */
    timelineResults: any = null;

    /*
     * Will be the last row clicked on (NodeInfo.java object) and having the red highlight bar
     */
    highlightRowNode: J.NodeInfo = null;

    idToNodeMap: { [key: string]: J.NodeInfo } = {};

    numSearchResults = (res: J.NodeSearchResponse): number => {
        return res != null && //
            res.searchResults != null && //
            res.searchResults.length != null ? //
            res.searchResults.length : 0;
    }

    searchTabActivated = () => {
    }

    searchNodesResponse = (res: J.NodeSearchResponse) => {
        this.searchResults = res;
        S.srch.populateSearchResultsPage(S.srch.searchResults, "searchResultsPanel");
        S.meta64.selectTab("searchTab");
    }

    timelineResponse = (res: J.NodeSearchResponse) => {
        this.timelineResults = res;
        S.srch.populateSearchResultsPage(S.srch.timelineResults, "timelineResultsPanel");
        S.meta64.selectTab("timelineTab");
    }

    searchFilesResponse = (res: J.FileSearchResponse) => {
        S.nav.mainOffset = 0;
        S.util.ajax<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
            "nodeId": res.searchResultNodeId,
            "upLevel": null,
            "siblingOffset": 0,
            "renderParentIfLeaf": null,
            "offset": 0,
            "goToLastPage": false,
            "forceIPFSRefresh": false
        }, S.nav.navPageNodeResponse);
    }

    /* prop = mtm (modification time) | ctm (create time) */
    timeline = (prop: string) => {
        let node = S.meta64.getHighlightedNode();
        if (!node) {
            S.util.showMessage("No node is selected to 'timeline' under.");
            return;
        }

        S.util.ajax<J.NodeSearchRequest, J.NodeSearchResponse>("nodeSearch", {
            "nodeId": node.id,
            "searchText": "",
            "sortDir": "DESC",
            "sortField": prop,
            "searchProp": null,
            "fuzzy": false,
            "caseSensitive": false
        }, this.timelineResponse);
    }

    initSearchNode = (node: J.NodeInfo) => {
        this.idToNodeMap[node.id] = node;
    }

    populateSearchResultsPage = (data: J.NodeSearchResponse, viewName) => {
        let childCount = data.searchResults.length;

        /*
         * Number of rows that have actually made it onto the page to far. Note: some nodes get filtered out on the
         * client side for various reasons.
         */
        let rowCount = 0;

        let output: Comp[] = [];
        let i = -1;
        data.searchResults.forEach((node: J.NodeInfo) => {
            i++;
            this.initSearchNode(node);

            rowCount++;
            output.push(this.renderSearchResultAsListItem(node, i, childCount, rowCount));
        });


        let div = new Div(null, null, output);
        div.updateDOM(viewName);
    }

    /*
     * Renders a single line of search results on the search results page.
     *
     * node is a NodeInfo.java JSON
     */
    renderSearchResultAsListItem = (node: J.NodeInfo, index: number, count: number, rowCount: number): Comp => {
        let id = node.id;
        //console.log("renderSearchResult: " + id);

        let cssId = this._UID_ROWID_PREFIX + id;
        // console.log("Rendering Node Row[" + index + "] with id: " +cssId)

        let buttonBar = this.makeButtonBarHtml(id);

        let content: Comp[] = S.render.renderNodeContent(node, true, true);

        return new Div(null, {
            className: "node-table-row inactive-row",
            onClick: (elm: HTMLElement) => {
                S.srch.clickOnSearchResultRow(id);
            }, //
            "id": cssId
        },//
            [
                buttonBar//
                , new Div(null, {
                    "id": "srch_content_" + id
                }, content)
            ]);
    }

    makeButtonBarHtml = (id: string): Comp => {
        let gotoButton = new Button("Go to Node", () => {
            S.srch.clickSearchNode(id);
        }, { id: "go-to-" + id });
        return S.render.makeHorizontalFieldSet([gotoButton]);
    }

    clickOnSearchResultRow = (id: string) => {
        this.setRowHighlight(false);
        this.highlightRowNode = this.idToNodeMap[id];
        this.setRowHighlight(true);
    }

    clickSearchNode = (id: string) => {
        /*
         * update highlight node to point to the node clicked on, just to persist it for later
         */
        this.highlightRowNode = this.idToNodeMap[id];
        if (!this.highlightRowNode) {
            throw "Unable to find uid in search results: " + id;
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
        let nodeId = this._UID_ROWID_PREFIX + this.highlightRowNode.id;

        let elm: HTMLElement = S.util.domElm(nodeId);
        if (elm) {
            /* change class on element */
            S.util.changeOrAddClassToElm(elm,
                state ? "inactive-row" : "active-row",
                state ? "active-row" : "inactive-row");
        }
    }
}
