import { Validator } from "../Validator";
import * as J from "../JavaIntf";
import { NodeInfo } from "../JavaIntf";

export class FeedViewProps {
    page = 0;
    refreshCounter = 0;
    searchTextState = new Validator();
    feedFilterFriends = false;
    feedFilterToMe = true;
    feedFilterFromMe = true;
    feedFilterToUser: string = null;
    feedFilterToDisplayName: string = null;
    feedFilterToPublic = false;
    applyAdminBlocks: true;
    name: string = J.Constant.FEED_TOFROMME;
    friendsTagSearch: string = null;
    feedDirty = false;
    feedLoading = false;
    results: NodeInfo[] = null;
    feedEndReached = false;
    feedDirtyList: NodeInfo[] = null;
    filterExpanded = false;
}
