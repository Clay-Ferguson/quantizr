import * as I from "../Interfaces";
import * as J from "../JavaIntf";
import { AppState } from "../AppState";

export interface SearchIntf {
    _UID_ROWID_PREFIX: string;

    searchNodes: any;
    searchText: string;

    searchOffset: number;
    timelineOffset: number;

    highlightRowNode: J.NodeInfo;

    idToNodeMap: { [key: string]: J.NodeInfo };

    numSearchResults(res: J.NodeSearchResponse): number;
    searchNodesResponse(res: J.NodeSearchResponse): any;
    timelineResponse(res: J.NodeSearchResponse): any;
    searchFilesResponse(res: J.FileSearchResponse, state: AppState): any;
    timeline(prop: string, state: AppState): any;
    initSearchNode(node: J.NodeInfo): any;
    renderSearchResultAsListItem(node: J.NodeInfo, index: number, count: number, rowCount: number, allowAvatar: boolean, prefix: string, isFeed: boolean, state: AppState): any;
    makeButtonBarHtml(node: J.NodeInfo, allowAvatar: boolean, state: AppState): any;
    cached_clickOnSearchResultRow(id : string): any;
    clickSearchNode(id: string, state: AppState): any;
    setRowHighlight(state: boolean): any;
    feed(nodeId: string): any;
}
