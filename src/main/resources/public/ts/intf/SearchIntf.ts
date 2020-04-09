import * as I from "../Interfaces";
import * as J from "../JavaIntf";

export interface SearchIntf {
    _UID_ROWID_PREFIX: string;

    searchNodes: any;
    searchText: string;

    searchOffset: number;
    timelineOffset: number;

    searchResults: any;
    timelineResults: any;
    highlightRowNode: J.NodeInfo;

    idToNodeMap: { [key: string]: J.NodeInfo };

    numSearchResults(res: J.NodeSearchResponse): number;
    searchNodesResponse(res: J.NodeSearchResponse): any;
    timelineResponse(res: J.NodeSearchResponse): any;
    searchFilesResponse(res: J.FileSearchResponse): any;
    timeline(prop: string): any;
    initSearchNode(node: J.NodeInfo): any;
    populateSearchResultsPage(data: J.NodeSearchResponse, viewName: string): any;
    renderSearchResultAsListItem(node, index, count, rowCount): any;
    makeButtonBarHtml(node: J.NodeInfo): any;
    clickOnSearchResultRow(id : string): any;
    clickSearchNode(id: string): any;
    setRowHighlight(state: boolean): any;
}
