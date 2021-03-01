import { AppState } from "../AppState";
import * as J from "../JavaIntf";

export interface SearchIntf {
    _UID_ROWID_PREFIX: string;

    searchNodes: any;
    searchText: string;

    searchOffset: number;
    timelineOffset: number;

    highlightRowNode: J.NodeInfo;

    idToNodeMap: { [key: string]: J.NodeInfo };

    numSearchResults(res: J.NodeSearchResponse): number;
    searchNodesResponse(res: J.NodeSearchResponse, searchDescription: string, isUserSearch: boolean): any;
    timelineResponse(res: J.NodeSearchResponse, timelineDescription: string): any;
    searchFilesResponse(res: J.FileSearchResponse, state: AppState): any;
    timeline(prop: string, state: AppState, timeRangeType: string, timelineDescription: string): any;
    initSearchNode(node: J.NodeInfo): any;
    renderSearchResultAsListItem(node: J.NodeInfo, index: number, count: number, rowCount: number, prefix: string, isFeed: boolean, isParent: boolean, allowAvatars: boolean, jumpButton: boolean, state: AppState): any;
    cached_clickOnSearchResultRow(id : string): any;
    clickSearchNode(id: string, state: AppState): any;
    feed(nodeId: string, feedUserName: string, page: number, searchText: string): any;
}
