import { ValHolder } from "../ValHolder";
import * as J from "../JavaIntf";
import { NodeInfo } from "../JavaIntf";

export class FeedViewProps {
    page = 0;
    refreshCounter = 0;
    searchTextState = new ValHolder();
    feedFilterFriends = false;
    feedFilterToMe = true;
    feedFilterFromMe = true;
    feedFilterToUser: string = null;
    feedFilterToDisplayName: string = null;
    feedFilterToPublic = false;
    applyAdminBlocks: true;
    name: string = J.Constant.FEED_TOFROMME;
    subHeading: string = "To/From Me";
    friendsTagSearch: string = null;
    feedDirty = false;
    feedLoading = false;
    results: NodeInfo[] = null;
    feedEndReached = false;
    feedDirtyList: NodeInfo[] = null;
    filterExpanded = false;
}
