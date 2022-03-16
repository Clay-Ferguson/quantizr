import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { Constants as C } from "../../Constants";
import { FollowersRSInfo } from "../../FollowersRSInfo";
import { TabIntf } from "../../intf/TabIntf";
import { S } from "../../Singletons";
import { FollowersResultSetView } from "../FollowersResultSetView";

export class FollowersResultSetViewData implements TabIntf {
    name = "Followers";
    id = C.TAB_FOLLOWERS;
    rsInfo = new FollowersRSInfo();
    scrollPos = 0;
    props = {};
    openGraphComps = [];

    isVisible = () => S.tabUtil.resultSetHasData(C.TAB_FOLLOWERS);
    constructView = (data: TabIntf) => new FollowersResultSetView<FollowersRSInfo>(data);
    getTabSubOptions = (state: AppState): Div => { return null; };
}
