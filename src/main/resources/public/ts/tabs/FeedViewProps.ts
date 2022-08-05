import { ValidatedState } from "../ValidatedState";
import * as J from "../JavaIntf";

export class FeedViewProps {
    page = 0;
    refreshCounter = 0;
    autoRefresh = true;
    searchTextState = new ValidatedState();
    feedFilterFriends = false;
    feedFilterToMe = false;
    feedFilterFromMe = false;
    feedFilterToUser: string = null;
    feedFilterToPublic = true;
    feedFilterLocalServer = false;
    applyAdminBlocks: true;

    /* If we're presenting a specific node as the root of our "Feed" view this holds it's id, otherwise
     for any non-node specific feed query this stays null. */
    feedFilterRootNode: J.NodeInfo = null;
    feedDirty = false;
    feedLoading = false;
    feedResults: J.NodeInfo[] = null;
    feedEndReached = false;

    feedDirtyList: J.NodeInfo[] = null;
    filterExpanded = false;
}
