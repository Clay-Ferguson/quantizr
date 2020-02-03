import * as I from "../Interfaces";
import { NodeSearchResponse } from "../Interfaces";

export interface SearchIntf {
    _UID_ROWID_PREFIX: string;

    searchNodes: any;
    searchText: string;

    searchOffset: number;
    timelineOffset: number;

    searchResults: any;
    timelineResults: any;
    highlightRowNode: I.NodeInfo;

    idToNodeMap: { [key: string]: I.NodeInfo };

    numSearchResults(): any;
    searchTabActivated(): any;
    searchNodesResponse(res: I.NodeSearchResponse): any;
    timelineResponse(res: I.NodeSearchResponse): any;
    searchFilesResponse(res: I.FileSearchResponse): any;
    timeline(prop: string): any;
    initSearchNode(node: I.NodeInfo): any;
    populateSearchResultsPage(data: NodeSearchResponse, viewName: string): any;
    renderSearchResultAsListItem(node, index, count, rowCount): any;
    makeButtonBarHtml(id: string): any;
    clickOnSearchResultRow(id : string): any;
    clickSearchNode(id: string): any;
    setRowHighlight(state: boolean): any;
}
