import { ValidatedState } from "../ValidatedState";
import * as J from "../JavaIntf";

export interface FeedViewProps {
    page?: number;
    refreshCounter?: number;
    autoRefresh?: boolean;
    searchTextState?: ValidatedState<any>;
    feedFilterFriends?: boolean;
    feedFilterToMe?: boolean;
    feedFilterFromMe?: boolean;
    feedFilterToPublic?: boolean;
    feedFilterLocalServer?: boolean;
    feedFilterRootNode?: J.NodeInfo;
    feedDirty?: boolean;
    feedLoading?: boolean;
    feedFilterNSFW?: boolean;
    feedResults?: J.NodeInfo[];
    feedEndReached?: boolean;
    feedDirtyList?: boolean;
    filterExpanded?: boolean;
}
