import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { OpenGraphPanel } from "../../comp/OpenGraphPanel";
import { Constants as C } from "../../Constants";
import { FollowersRSInfo } from "../../FollowersRSInfo";
import { TabIntf } from "../../intf/TabIntf";
import { S } from "../../Singletons";
import { FollowersResultSetView } from "../FollowersResultSetView";

export class FollowersResultSetViewData implements TabIntf {
    name = "Followers";
    tooltip = "Followers of your account";
    id = C.TAB_FOLLOWERS;
    rsInfo = new FollowersRSInfo();
    scrollPos = 0;
    props = {};
    openGraphComps: OpenGraphPanel[] = [];

    isVisible = (state: AppState) => S.tabUtil.resultSetHasData(C.TAB_FOLLOWERS);
    constructView = (data: TabIntf) => new FollowersResultSetView<FollowersRSInfo>(data);
    getTabSubOptions = (state: AppState): Div => { return null; };
}
