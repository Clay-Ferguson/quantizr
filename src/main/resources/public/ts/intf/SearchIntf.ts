import { AppState } from "../AppState";
import * as J from "../JavaIntf";

export interface SearchIntf {
    _UID_ROWID_PREFIX: string;

    highlightRowNode: J.NodeInfo;
    idToNodeMap : Map<string, J.NodeInfo>;

    findSharedNodes(node: J.NodeInfo, page: number, type: string, shareTarget: string, accessOption: string, state: AppState): void;
    searchAndReplace(recursive: boolean, nodeId: string, search: string, replace: string, state: AppState): any;
    search(node: J.NodeInfo, prop: string, searchText: string, state: AppState, userSearchType: string, description: string, fuzzy: boolean, caseSensitive: boolean, page: number, successCallback: Function): void;
    searchFilesResponse(res: J.FileSearchResponse, state: AppState): any;
    timeline(node: J.NodeInfo, prop: string, state: AppState, timeRangeType: string, timelineDescription: string, page: number): any;
    initSearchNode(node: J.NodeInfo): any;
    renderSearchResultAsListItem(node: J.NodeInfo, index: number, count: number, rowCount: number, prefix: string, isFeed: boolean, isParent: boolean, allowAvatars: boolean, jumpButton: boolean, allowHeader: boolean, allowFooter: boolean, state: AppState): any;
    clickSearchNode(id: string, state: AppState): any;
    feed(nodeId: string, feedUserName: string, page: number, searchText: string, forceMetadataOn: boolean, growResults: boolean): any;
    showFollowers(page: number, userName: string): void;
    showFollowing(page: number, userName: string): void;
}
