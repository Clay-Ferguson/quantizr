import * as I from "../Interfaces";
import { NodeSearchResponse } from "../Interfaces";

export interface SearchIntf {
    _UID_ROWID_PREFIX: string;

    searchNodes: any;

    searchOffset: number;
    timelineOffset: number;

    searchResults: any;
    timelineResults: any;
    highlightRowNode: I.NodeInfo;
    identToUidMap: any;

    uidToNodeMap: { [key: string]: I.NodeInfo };
    numSearchResults(): any;
    searchTabActivated(): any;
    searchNodesResponse(res: I.NodeSearchResponse): any;
    timelineResponse(res: I.NodeSearchResponse): any;
    searchFilesResponse(res: I.FileSearchResponse): any;
    timeline(prop: string): any;
    initSearchNode(node: I.NodeInfo): any;
    populateSearchResultsPage(data: NodeSearchResponse, viewName: string): any;
    renderSearchResultAsListItem(node, index, count, rowCount): any;
    makeButtonBarHtml(uid: string): any;
    clickOnSearchResultRow(uid : string): any;
    clickSearchNode(uid: string): any;
    setRowHighlight(state: boolean): any;
}
